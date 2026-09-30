import Utils from "./utils.js"
import type { LazyloadT } from "./defs.js"
import { ReadDistFile, STATIC_PATH } from "./asset_files_ver2.js"
import { GatherDependencies, LazyloadFilePath } from "./lazyloads_ver2.js"
import { LoadViewData } from "./viewdata_ver2.js"
import { MatchViewPath } from "./view_match_ver2.js"
import { LoadViewAsset } from "./asset_view_ver2.js"
import { LoadComponentAsset } from "./asset_component_ver2.js"
import { LoadThirdPartyAsset } from "./asset_thirdparty_ver2.js"


type InlinedShellT = { indexhtml:string, head:string }

let _inlined_shell:InlinedShellT | null = null




// Production (dist) only; dev page loads get the warm load page instead.
// Returns the full page for viewpath with every asset and the view data inlined, brotli compressed.
export async function BuildColdLoadPage(viewpath:string):Promise<Buffer> {
	const { lazyload } = await MatchViewPath(viewpath)
	const [shell, dependencies] = await Promise.all([load_inlined_shell(), GatherDependencies(lazyload)])

	// Unhandled Case: a view declared as a dependency is skipped here, though its own dependencies were still gathered.
	const dependency_assets = dependencies.filter((dependency) => dependency.type !== "view")
	const [dependency_scripts, view_script, viewdata] = await Promise.all([
		Promise.all(dependency_assets.map(load_dependency_asset)),
		LoadViewAsset(LazyloadFilePath(lazyload), false) as Promise<string>,
		LoadViewData(viewpath),
	])

	// Module scripts run in document order after parsing: main, then dependencies (each before its dependents), then
	// the view. Each asset gets its own tag so raw ESM thirdparty files keep their own scope and exports.
	// The classic data script runs during parsing, before any of them.
	const scripts = [
		`<script>window.__n2_appcoldload = ${Utils.SerializeTemplateLiteralData(viewdata)};</script>`,
		...dependency_scripts.map(inline_module_script),
		inline_module_script(view_script),
	].join("\n")

	const html = shell.indexhtml.replace("<!--{--js_css--}-->", () => shell.head + "\n" + scripts)
	return Utils.Compress(html)
}




function load_dependency_asset(dependency:LazyloadT):Promise<string> {
	const path = LazyloadFilePath(dependency)
	if (dependency.type === "component") return LoadComponentAsset(path, false) as Promise<string>

	return LoadThirdPartyAsset(path, false) as Promise<string>
}




// Dist files never change while the server runs, so the shell is read once.
// main.min.js already contains instance/main.js and SETTINGS from the dist build.
async function load_inlined_shell():Promise<InlinedShellT> {
	if (_inlined_shell) return _inlined_shell

	const [indexhtml, indexcss, maincss, instancemaincss, mainjs] = await Promise.all([
		Bun.file(STATIC_PATH + "instance/index.html").text(),
		...["index.css", "main.css", "instance/main.css", "main.js"].map((path) => ReadDistFile(path, false) as Promise<string>),
	])

	// main.css and instance/main.css become constructed sheets, which switchstation adopts into each view's shadow root.
	const sheets = [["maincss", maincss], ["instancemaincss", instancemaincss]]
		.map(([name, css]) => `window.css_${name} = new CSSStyleSheet(); window.css_${name}.replaceSync(${Utils.SerializeTemplateLiteralData(css)});`)
		.join("\n")

	_inlined_shell = {
		indexhtml,
		head: [
			`<style>${indexcss}</style>`,
			`<script>${sheets}\ndocument.adoptedStyleSheets.push(window.css_maincss, window.css_instancemaincss);</script>`,
			inline_module_script(mainjs),
		].join("\n"),
	}
	return _inlined_shell
}




// Unhandled Case: "</script" inside inlined JS (e.g. in a template string) ends the tag early.
function inline_module_script(js:string):string {
	return `<script type="module">${js}</script>`
}
