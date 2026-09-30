import * as path_util from "node:path"
import type { LazyloadT } from "./defs.js"
import { EscapeTemplateAsset } from "./inline_template.js"
import { URLBase } from "./url_base.js"




export async function ViewLoad(viewurl:string, basepath:string, static_dir:string, lazyloads:Set<LazyloadT>, is_prod:boolean, request_url:string):Promise<Response> {

	const pathname = new URL(viewurl, URLBase(basepath, request_url)).pathname.replace(/^\/(?:v\/)?/, "")
	const view = [...lazyloads].find((lazyload) => {
		if (lazyload.type !== "view") return false
		if (lazyload.urlmatch_regex) return new RegExp(lazyload.urlmatch_regex).test(pathname)
		if (!lazyload.urlmatch) return false

		const pattern = lazyload.urlmatch
			.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			.replace(/:([a-zA-Z_0-9]+)/g, "([^/]+)")
		return new RegExp(`^${pattern}$`).test(pathname)
	})
	if (!view) throw new Error(`Lazyload view not found: ${viewurl}`)

	const relative_base = `${view.is_instance ? "instance/" : ""}lazy/views/${view.name}/${view.name}`
	const absolute_prefix = path_util.resolve(basepath, static_dir)
	const headers = new Headers({
		"Content-Type": "text/javascript; charset=UTF-8",
		"Cache-Control": "no-store",
	})

	if (!is_prod) {
		// Bundle relative viewpart imports so they resolve from the view source,
		// not from this /api/view-load response URL.
		const returnstr = await BundleViewJavascriptForDev(absolute_prefix, `${relative_base}.js`, false, true)
		return new Response(returnstr, { status: 200, headers })
	}

	const file = await GetViewJavascriptForDist(absolute_prefix, relative_base, true)
	if (file.name?.endsWith(".br")) headers.set("Content-Encoding", "br")
	return new Response(file, { status: 200, headers })
}




// Returns the prebuilt dist view file. Brotli is only offered when the caller can
// serve it with a Content-Encoding header; inlining callers need plain text.
export async function GetViewJavascriptForDist(absolute_prefix:string, relative_base:string, allow_br:boolean) {
	const paths = [
		...(allow_br ? [`${relative_base}.js.br`] : []),
		`${relative_base}.min.js`,
		`${relative_base}.js`,
	]
	const path = await first_existing_path(absolute_prefix, paths)
	return Bun.file(path_util.resolve(absolute_prefix, path))
}


async function first_existing_path(absolute_prefix:string, paths:string[]):Promise<string> {
	for (const path of paths) {
		if (await Bun.file(path_util.resolve(absolute_prefix, path)).exists()) return path
	}

	// View build outputs are required; let Bun return the missing fallback if none exist.
	return paths[paths.length - 1]
}




export const BundleViewJavascriptForDev = async (absolute_prefix:string, file:string, is_prod:boolean, include_core_styles = false):Promise<string> => {
	const result = await Bun.build({
		entrypoints: [path_util.resolve(absolute_prefix, file)],
		target: "browser",
		format: "esm",
		splitting: false,
		minify: false, // build process already minifies
		env: "disable",
		plugins: [{
			name: "inline-view-assets",
			setup(build) {
				build.onLoad({ filter: /\.js$/ }, async ({ path }) => {
					const js = await Bun.file(path).text()
					const has_html = js.includes("{--html--}")
					const has_css = /\{--css(?:--)?\}/.test(js)
					if (!has_html && !has_css) return { contents: js, loader: "js" }

					// Placeholder assets share the JS filename stem and directory, including imports.
					// Missing referenced assets fail the build; CSS URLs/@imports remain unchanged.
					const base = path.slice(0, -3)
					const [html, css] = await Promise.all([
						has_html ? Bun.file(base + ".html").text() : "",
						has_css && is_prod ? Bun.file(base + ".css").text() : "",
					])
					const css_url = "/" + path_util.relative(absolute_prefix, base + ".css").split(path_util.sep).join("/")
					const core_styles = include_core_styles && !is_prod
						? '<link rel="stylesheet" href="/main.css"><link rel="stylesheet" href="/instance/main.css">'
						: ""
					const style = is_prod ? `<style>${css}</style>` : `${core_styles}<link rel="stylesheet" href="${css_url}">`

					return {
						contents: js.replace(/\{--html--\}|\{--css(?:--)?\}/g, (placeholder) =>
							EscapeTemplateAsset(placeholder === "{--html--}" ? html : style)),
						loader: "js",
					}
				})
			},
		}],
	})

	if (!result.success) throw new AggregateError(result.logs, "Could not assemble view assets")
	return result.outputs[0].text()
}
