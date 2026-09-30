type AssetOptionsT = {
	content_type:string
	path:string
}



export function GetIndex(basepath:string, static_dir:string, is_prod:boolean):Promise<Response> {
	return asset_response(basepath, static_dir, is_prod, {
		content_type: "text/html; charset=UTF-8",
		path: "instance/index.html",
	})
}



export function GetMainJS(basepath:string, static_dir:string, is_prod:boolean):Promise<Response> {
	return asset_response(basepath, static_dir, is_prod, {
		content_type: "text/javascript; charset=UTF-8",
		path: "main.js",
	})
}



export function GetIndexCSS(basepath:string, static_dir:string, is_prod:boolean):Promise<Response> {
	return asset_response(basepath, static_dir, is_prod, {
		content_type: "text/css; charset=UTF-8",
		path: "index.css",
	})
}



export function GetMainCSS(basepath:string, static_dir:string, is_prod:boolean):Promise<Response> {
	return asset_response(basepath, static_dir, is_prod, {
		content_type: "text/css; charset=UTF-8",
		path: "main.css",
	})
}



export function GetInstanceMainCSS(basepath:string, static_dir:string, is_prod:boolean):Promise<Response> {
	return asset_response(basepath, static_dir, is_prod, {
		content_type: "text/css; charset=UTF-8",
		path: "instance/main.css",
	})
}



export function GetIconsCSS(basepath:string, static_dir:string, is_prod:boolean):Promise<Response> {
	return asset_response(basepath, static_dir, is_prod, {
		content_type: "text/css; charset=UTF-8",
		path: "instance/icons.css",
	})
}



async function asset_response(basepath:string, static_dir:string, is_prod:boolean, options:AssetOptionsT):Promise<Response> {
	const paths = asset_paths(options.path, is_prod)
	const path = await first_existing_path(basepath + static_dir, paths)
	const headers = new Headers({
		"Content-Type": options.content_type,
		"Cache-Control": "no-store",
	})

	const file = Bun.file(basepath + static_dir + path)
	const contents = await file.arrayBuffer()

	if (path.endsWith(".br")) headers.set("Content-Encoding", "br")
	// The service worker reads this from its cached index to build production stylesheets.
	if (is_prod) headers.set("Nifty-Prod", "1")
	return new Response(contents, { status: 200, headers })
}



function asset_paths(path:string, is_prod:boolean):string[] {
	if (!is_prod) return [path]

	return [`${path}.br`, path]
}



async function first_existing_path(absolute_prefix:string, paths:string[]):Promise<string> {
	for (const path of paths) {
		if (await Bun.file(absolute_prefix + path).exists()) return path
	}

	// Core assets are required build outputs; let Bun return the missing fallback if none exist.
	return paths[paths.length - 1]
}
