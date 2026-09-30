import * as path_util from "node:path"
import { EscapeTemplateAsset } from "./inline_template.js"


export const IS_PROD = (process.env.NODE_ENV || "dev") !== "dev"
export const STATIC_PATH = process.cwd() + "/" + (IS_PROD ? "static_dist/" : "static_dev/")




// path is relative to the static dir, e.g. "main.css" or "lazy/components/btn/btn.js".
// The dist build leaves X.min.js / X.min.css (plain) and X.js.br / X.css.br (brotli) side by side; X itself is removed.
// Unhandled Case: a missing dist file rejects on .text(), or fails when the returned file is streamed.
export async function ReadDistFile(path:string, get_compressed:boolean):Promise<string | Blob> {
	if (get_compressed) return Bun.file(STATIC_PATH + path + ".br")

	return Bun.file(STATIC_PATH + path.replace(/\.(js|css)$/, ".min.$1")).text()
}




// Bundles a dev .js entry with its relative imports (e.g. view parts). In every bundled file {--html--} becomes
// the sibling .html and {--css--} becomes css_tags(/assets/ url of the sibling .css).
// Nothing is cached, so dev edits show on the next request.
// Unhandled Case: a {--html--} placeholder without a sibling .html fails the build.
export async function BundleDevFile(path:string, css_tags:(css_url:string) => string):Promise<string> {
	const result = await Bun.build({
		entrypoints: [STATIC_PATH + path],
		target: "browser",
		format: "esm",
		splitting: false,
		minify: false,
		env: "disable",
		plugins: [{
			name: "inline-dev-assets",
			setup(build) {
				build.onLoad({ filter: /\.js$/ }, async ({ path }) => {
					const js = await Bun.file(path).text()
					const has_html = js.includes("{--html--}")
					const has_css = js.includes("{--css--}")
					if (!has_html && !has_css) return { contents: js, loader: "js" }

					const file_base = path.slice(0, -3)
					const html = has_html ? await Bun.file(file_base + ".html").text() : ""
					const css_url = "/assets/" + path_util.relative(STATIC_PATH, file_base + ".css").split(path_util.sep).join("/")
					const css = css_tags(css_url)

					return {
						contents: js.replace(/\{--html--\}|\{--css--\}/g, (placeholder) =>
							EscapeTemplateAsset(placeholder === "{--html--}" ? html : css)),
						loader: "js",
					}
				})
			},
		}],
	})

	if (!result.success) throw new AggregateError(result.logs, "Could not bundle dev file: " + path)
	return result.outputs[0].text()
}
