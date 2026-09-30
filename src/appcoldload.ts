import * as path_util from "node:path"
import Utils from "./utils.js"
import type { LazyloadT } from "./defs.js"
import { ComponentLoad } from "./componentload.js"
import { ThirdPartyLoad } from "./thirdpartyload.js"
import { ViewDataLoad } from "./view_dataload.js"
import { BundleViewJavascriptForDev, GetViewJavascriptForDist } from "./view_load.js"
import { URLBase } from "./url_base.js"


type AppShellAssetsT = {
	indexhtml:string
	indexcss:string
	maincss:string
	instancemaincss:string
	mainjs:string
}

const _cached_asset_files:AppShellAssetsT = {indexhtml:'',indexcss:'',maincss:'',instancemaincss:'',mainjs:''}
let   _is_asset_files_cached = false;


export async function AppColdLoad(viewurl:string, basepath:string, static_dir:string, lazyloads:Set<LazyloadT>, is_prod:boolean, request_url:string):Promise<{returnstr:string}> {

	const absolute_prefix = basepath + static_dir
	await load_app_shell_assets(absolute_prefix, is_prod)

	const appshellassets_inlined_string = await appshellassets_inlined(viewurl, basepath, static_dir, lazyloads, is_prod, request_url);

	const htmlstr = _cached_asset_files.indexhtml.replace('<!--{--js_css--}-->', () => appshellassets_inlined_string + "\n" + '')

	return { returnstr: htmlstr }
}


async function appshellassets_inlined(viewurl:string, basepath:string, static_dir:string, lazyloads:Set<LazyloadT>, is_prod:boolean, request_url:string) {

	const { returnstr } = await appcoldload_view(viewurl, basepath, static_dir, lazyloads, is_prod, request_url)
	let style = ''
	let script = `<script type="module" name='main'>${_cached_asset_files.mainjs}</script>`
	// Publish the module-scoped data only for app cold loads; the client consumes this once.
	script += `\n<script type="module" name='view'>${returnstr}\n;\nwindow.__n2_appcoldload = viewdata;\n</script>`

	if (is_prod) {
		style  = `<style name='indexcss'>${_cached_asset_files.indexcss}</style>`
		const sheets = [
			["maincss", _cached_asset_files.maincss],
			["instancemaincss", _cached_asset_files.instancemaincss],
		].map(([name, css]) => `window.css_${name} = new CSSStyleSheet(); window.css_${name}.replaceSync(${Utils.SerializeTemplateLiteralData(css)});`).join("\n")
		style += `<script>${sheets}\ndocument.adoptedStyleSheets.push(window.css_maincss, window.css_instancemaincss);</script>`
	} else {
		// Keep dev CSS external for Chrome editing; absolute URLs also work on /v/... routes.
		style  = `<link rel='stylesheet' href='/index.css'>`
		style += `<link rel='stylesheet' href='/main.css'>`
		style += `<link rel='stylesheet' href='/instance/main.css'>`
	}

	return script + '\n\n' + style
}




export async function appcoldload_view(viewurl:string, basepath:string, static_dir:string, lazyloads:Set<LazyloadT>, is_prod:boolean, request_url:string):Promise<{returnstr:string}> {

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

	const absolute_prefix = path_util.resolve(basepath, static_dir)
	const relative_base = `${view.is_instance ? "instance/" : ""}lazy/views/${view.name}/${view.name}`
	const [view_js, viewdata] = await Promise.all([
		is_prod
			? GetViewJavascriptForDist(absolute_prefix, relative_base, false).then((file) => file.text())
			: BundleViewJavascriptForDev(absolute_prefix, `${relative_base}.js`, false, true),
		ViewDataLoad(viewurl, basepath, static_dir, lazyloads, is_prod, request_url),
	])

	const component_names = new Set((view.dependencies ?? [])
		.filter((dependency) => dependency.type === "component")
		.map((dependency) => dependency.name))
	const thirdparty_names = new Set((view.dependencies ?? [])
		.filter((dependency) => dependency.type === "thirdparty")
		.map((dependency) => dependency.name))
	const [thirdparties, components] = await Promise.all([
		Promise.all([...thirdparty_names].map((name) =>
			ThirdPartyLoad(name, basepath, static_dir, lazyloads, is_prod))),
		Promise.all([...component_names].map((name) =>
			ComponentLoad(name, basepath, static_dir, lazyloads, is_prod))),
	])

	const returnstr = [
		...thirdparties.map((thirdparty) => thirdparty.returnstr),
		...components.map((component) => component.returnstr),
		`const viewdata = ${Utils.SerializeTemplateLiteralData(viewdata)}`,
		view_js,
	].join("\n;\n")
	return { returnstr }
}




async function load_app_shell_assets(absolute_prefix:string, is_prod:boolean) {

	if (_is_asset_files_cached) 
		return;

	const [indexhtml, indexcss, maincss, instancemaincss, mainjs] = await Promise.all([
		Bun.file(absolute_prefix + "instance/index.html").text(),
		is_prod ? Bun.file(absolute_prefix + `index${is_prod?'.min':''}.css`).text() : '',
		is_prod ? Bun.file(absolute_prefix + `main${is_prod?'.min':''}.css`).text() : '',
		is_prod ? Bun.file(absolute_prefix + `instance/main${is_prod?'.min':''}.css`).text() : '',
		is_prod ? Bun.file(absolute_prefix + "main.min.js").text() : Utils.BundleJavascript(absolute_prefix, [ 'main.js' ], false)
		
	])

	_cached_asset_files.indexhtml = indexhtml;
	_cached_asset_files.indexcss = indexcss;
	_cached_asset_files.maincss = maincss;
	_cached_asset_files.instancemaincss = instancemaincss;
	_cached_asset_files.mainjs = mainjs;

	_is_asset_files_cached = true;
}




