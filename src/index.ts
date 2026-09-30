

import { AddListener } from "./sse.js"
export { NotifyChanged } from "./sse.js"
import { GetScope as GetLocalDBScope, HandleSnapshot as HandleLocalDBSnapshot } from "./localdb_sync.js"
export { Init as InitLocalDB, NotifyChanged as NotifyLocalDBChanged } from "./localdb_sync.js"
export type { LocalDBOptionsT, LocalDBChangeT } from "./localdb_sync.js"
import { BuildColdLoadPage } from "./page_coldload_ver2.js"
import { BuildWarmLoadPage } from "./page_warmload_ver2.js"
import { LoadRequestedAsset } from "./asset_request_ver2.js"
import { LoadViewData } from "./viewdata_ver2.js"
import { GeneralAssetFile } from "./filerequest.js"
import Utils from "./utils.js"

const VAR_NODE_ENV        = process.env.NODE_ENV || 'dev';
const BASEPATH = process.cwd() + "/"
const STATIC_DIR = VAR_NODE_ENV === "dev" ? "static_dev/" : "static_dist/"
const APPVERSION=0;
const IS_PROD = VAR_NODE_ENV === "dev" ? false : true




export async function HandleRequest(req:Request):Promise<Response|null> {

	if (req.method !== "GET") return null

	const url = new URL(req.url)
	const pathname = url.pathname

	if (pathname === "/api/events") return AddListener(req, await GetLocalDBScope(req))
	if (pathname === "/api/localdb") return HandleLocalDBSnapshot(req)
	if (pathname === "/favicon.ico") return favicon()
	if (pathname === "/apple-touch-icon.png") return apple_touch_icon()
	if (pathname === "/apple-touch-icon-precomposed.png") return apple_touch_icon_precomposed()
	if (pathname === "/api/view-data") return serve_viewdata(url.searchParams.get("viewpath"))

	// View loaders execute on the server and must never be served as browser assets, including their dist .br siblings.
	if (/_load(?:\.min)?\.js(?:\.br)?$/.test(pathname)) return new Response("Not found", { status: 404 })

	// Every asset is fetched as /assets/<file path in the static dir>, except the page shell at /assets/index.html.
	if (pathname === "/assets/index.html") return serve_warmload_page()
	if (pathname.startsWith("/assets/")) return serve_asset(pathname.slice("/assets/".length))

	// Cold load is dist only; dev page loads (refreshes included) get the warm load page.
	if (pathname === "/" || pathname === "/index.html") return IS_PROD ? serve_coldload_page("home" + url.search) : serve_warmload_page()
	if (pathname.startsWith("/v/")) return IS_PROD ? serve_coldload_page(pathname.slice(3) + url.search) : serve_warmload_page()

	return general_asset_file(req)
}




function favicon():Response {
	return new Response(Bun.file(BASEPATH + STATIC_DIR + "instance/media/favicon.svg"))
}




function apple_touch_icon():Response {
	return new Response(Bun.file(BASEPATH + STATIC_DIR + "instance/media/apple-touch-icon.png"))
}




function apple_touch_icon_precomposed():Response {
	return new Response(Bun.file(BASEPATH + STATIC_DIR + "instance/media/apple-touch-icon-precomposed.png"))
}




async function serve_viewdata(viewpath:string | null):Promise<Response> {
	if (!viewpath) {
		return new Response("Missing viewpath", {
			status: 400,
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8',
				'Cache-Control': 'no-store',
			},
		})
	}

	try {
		const data = await LoadViewData(viewpath)
		return new Response(Utils.SerializeTemplateLiteralData(data), {
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=UTF-8',
				'Cache-Control': 'no-store',
			},
		})
	} catch {
		return new Response("Could not load view data: " + viewpath, {
			status: 400,
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8',
				'Cache-Control': 'no-store',
			},
		})
	}
}


async function serve_asset(asset_path:string):Promise<Response> {
	try {
		const asset = await LoadRequestedAsset(asset_path)
		if (!asset) return asset_not_found(asset_path)

		// Dist assets are always the prebuilt brotli files; dev assets are plain.
		const headers = new Headers({
			'Content-Type': asset.content_type,
			'Cache-Control': 'no-store',
		})
		if (IS_PROD) headers.set('Content-Encoding', 'br')
		return new Response(asset.body, { status: 200, headers })
	} catch (error) {
		console.error(`Could not load asset: ${asset_path}`, error)
		return asset_not_found(asset_path)
	}
}




function asset_not_found(asset_path:string):Response {
	return new Response(`Asset not found: ${asset_path}`, {
		status: 404,
		headers: {
			'Content-Type': 'text/plain; charset=UTF-8',
			'Cache-Control': 'no-store',
		},
	})
}




async function serve_warmload_page():Promise<Response> {
	return new Response(await BuildWarmLoadPage(), {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=UTF-8',
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
		},
	})
}




async function serve_coldload_page(path_str:string):Promise<Response> {

	try {
		const body = await BuildColdLoadPage(path_str)
		const headers = new Headers({
			'Content-Type': 'text/html; charset=UTF-8',
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
			'Content-Encoding': 'br',
		})

		return new Response(Uint8Array.from(body), { status: 200, headers })
	} catch (error) {
		console.error(`Could not load view: ${path_str}`, error)
		return new Response("Could not load view: " + path_str, {
			status: 400,
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8',
				'Cache-Control': 'no-store',
			},
		})
	}
}




async function general_asset_file(req:Request):Promise<Response> {
	const headers = new Headers()
	let response:Response | null = null
	const res = {
		set(name:string, value:string) {
			headers.set(name, value)
		},
		sendFile(path:string) {
			response = new Response(Bun.file(path), { headers })
		},
	}
	const nocache = !new URL(req.url).pathname.includes("shared_worker.js") // not yet sure why shared_worker is being cached

	await GeneralAssetFile(req.url, res, BASEPATH, STATIC_DIR, nocache, IS_PROD)
	return response ?? new Response("Not found", { status: 404 })
}



// END ROUTES
















// app.get('/v/*restofpath', serveview)










