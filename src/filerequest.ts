import * as path_util from "node:path"


const FILE_CONTENT_TYPES:Record<string, string> = {
	".css": "text/css; charset=UTF-8",
	".gif": "image/gif",
	".html": "text/html; charset=UTF-8",
	".ico": "image/x-icon",
	".js": "text/javascript; charset=UTF-8",
	".jpg": "image/jpeg",
	".json": "application/json; charset=UTF-8",
	".mp4": "video/mp4",
	".png": "image/png",
	".svg": "image/svg+xml",
	".webmanifest": "application/manifest+json; charset=UTF-8",
	".woff2": "font/woff2",
}


export const GeneralAssetFile = async (fileurl:string, res:any, basepath:string, static_dir:string, nocache:boolean = true, _is_prod:boolean = false) => {
	const pathname = new URL(fileurl).pathname
	const file_path = path_util.resolve(basepath, static_dir, "." + pathname)
	const file = Bun.file(file_path)
	if (!await file.exists()) return false

	if (nocache) res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
	const extension = path_util.extname(file_path).toLowerCase()
	const content_type = FILE_CONTENT_TYPES[extension] ?? "application/octet-stream"
	res.set('Content-Type', content_type)
	res.sendFile(file_path)
	return true
}
