import * as path_util from "node:path"
import type { LazyloadT } from "./defs.js"
import { EscapeTemplateAsset } from "./inline_template.js"

const _cached_component_asset_files = new Map<string, string>()


export async function ComponentLoad(name:string, basepath:string, static_dir:string, lazyloads:Set<LazyloadT>, is_prod:boolean):Promise<{returnstr:string}> {
	const component = [...lazyloads].find((lazyload) => lazyload.type === "component" && lazyload.name === name)
	if (!component) throw new Error(`Lazyload component not found: ${name}`)

	const absolute_prefix = path_util.resolve(basepath, static_dir)
	const file = `${component.is_instance ? "instance/" : ""}lazy/components/${component.name}/${component.name}${is_prod ? ".min" : ""}.js`
	const cache_key = JSON.stringify([path_util.resolve(absolute_prefix, file), is_prod])
	const cached = _cached_component_asset_files.get(cache_key)
	if (cached !== undefined) return { returnstr: cached }

	// Only this component entry and its JS imports are bundled, not its declared dependencies.
	const returnstr = await bundle_component_javascript(absolute_prefix, file, is_prod)
	_cached_component_asset_files.set(cache_key, returnstr)
	return { returnstr }
}


const bundle_component_javascript = async (absolute_prefix:string, file:string, is_prod:boolean):Promise<string> => {
	const result = await Bun.build({
		entrypoints: [path_util.resolve(absolute_prefix, file)],
		target: "browser",
		// Isolate bindings so multiple component bundles can precede the view in one string.
		format: "iife",
		splitting: false,
		minify: false, // build process already minifies for production and want no minify on dev
		env: "disable",
		plugins: [{
			name: "inline-component-assets",
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
					const style = is_prod ? `<style>${css}</style>` : `<link rel="stylesheet" href="${css_url}">`

					return {
						contents: js.replace(/\{--html--\}|\{--css(?:--)?\}/g, (placeholder) =>
							EscapeTemplateAsset(placeholder === "{--html--}" ? html : style)),
						loader: "js",
					}
				})
			},
		}],
	})

	if (!result.success) throw new AggregateError(result.logs, "Could not assemble component assets")
	return result.outputs[0].text()
}
