import * as path_util from "path";


const FILE_CONTENT_TYPES:Record<string, string> = {
	".css": "text/css; charset=UTF-8",
	".mp4": "video/mp4",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".webmanifest": "application/manifest; charset=UTF-8",
}


export const HandleAssetFile = async (fileurl:string, res:any, basepath:string, static_dir:string, nocache:boolean = true, is_prod:boolean = false) => {

	if (nocache) {
		res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
	}

	const file_path = fileurl.startsWith('/') ? fileurl.slice(1) : fileurl
	const absolute_prefix = basepath + static_dir
	const extension = path_util.extname(file_path).toLowerCase()

	if (extension === ".js") {
		await handle_javascript(absolute_prefix, file_path, res, is_prod)
		return true
	}

	const content_type = FILE_CONTENT_TYPES[extension]
	if (!content_type) return true

	res.set('Content-Type', content_type)
	res.sendFile(absolute_prefix + file_path)

	return true
}


async function handle_javascript(absolute_path:string, js_path:string, res:any, is_prod:boolean) {

	res.set('Content-Type', 'application/javascript; charset=UTF-8')

	const path_without_extension = js_path.slice(0, -path_util.extname(js_path).length)
	const filename = path_util.basename(path_without_extension)
	const parent_dir_name = path_util.basename(path_util.dirname(path_without_extension))
	const path_parts = js_path.split('/')
	const is_entry_file = filename === parent_dir_name
	const is_lazy = path_parts.includes("lazy")

	const is_component = is_lazy && is_entry_file && path_parts.includes("components")
	const is_view = is_lazy && is_entry_file && path_parts.includes("views")
	const is_view_part = is_view && path_parts.includes("parts")

	if (is_prod) {
		const production_path = is_component || is_view
			? path_without_extension + ".min.js"
			: js_path

		res.sendFile(absolute_path + production_path)
		return
	}

	if (is_component) {
		const js = await flesh_out(absolute_path, path_without_extension, [
			`/${path_without_extension}.css`,
		])
		res.send(js)
		return
	}

	if (is_view || is_view_part) {
		const js = await flesh_out(absolute_path, path_without_extension, view_css_paths(path_without_extension))
		res.send(js)
		return
	}


	res.sendFile(absolute_path + js_path)
}


async function flesh_out(absolute_path:string, path_without_extension:string, css_paths:string[]):Promise<string> {

	const [html, js] = await Promise.all([
		Bun.file(absolute_path + path_without_extension + ".html").text(),
		Bun.file(absolute_path + path_without_extension + ".js").text(),
	])
	const css_links = css_paths.map((css_path) => `<link rel="stylesheet" href="${css_path}">`).join('\n')

	return js
		.replace("{--html--}", html)
		.replace("{--css--}", css_links)
}


function view_css_paths(path_without_extension:string):string[] {
	return [
		"/main.css",
		"/instance/main.css",
		"/instance/icons.css",
		`/${path_without_extension}.css`,
	]
}

