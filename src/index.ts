

import SSE from "./sse.js"
import { HandleAssetFile } from "./filerequest.js"
import { HandleFirstBoot } from "./view.js"
import Utils from "./utils.js"

const VAR_NODE_ENV        = process.env.NODE_ENV || 'dev';
const BASEPATH = process.cwd() + "/"
const STATIC_DIR = VAR_NODE_ENV === "dev" ? "static_dev/" : "static_dist/"
const APPVERSION=0; 
const IS_PROD = VAR_NODE_ENV === "dev" ? false : true





export async function HandleRequest(req:Request):Promise<Response|null> {

	if (req.method !== "GET") return null

	const pathname = new URL(req.url).pathname

	if (pathname === "/favicon.ico") return favicon()
	if (pathname === "/apple-touch-icon.png") return apple_touch_icon()
	if (pathname === "/apple-touch-icon-precomposed.png") return apple_touch_icon_precomposed()

	if (pathname === "/" || pathname === "/index.html") return servefirstboot("home")
	if (pathname.startsWith("/v/")) return servefirstboot(pathname.slice(3))

	return assets_general(req)
}




function favicon():Response {
	return new Response(Bun.file(BASEPATH + STATIC_DIR + "instance/media/favicon.svg"))
}




function apple_touch_icon():Response {
	return new Response(Bun.file(BASEPATH + STATIC_DIR + "media/pwticons/apple-touch-icon.png"))
}




function apple_touch_icon_precomposed():Response {
	return new Response(Bun.file(BASEPATH + STATIC_DIR + "media/pwticons/apple-touch-icon-precomposed.png"))
}




async function servefirstboot(path_str:string):Promise<Response> {

	try {
		const { returnstr, viewname } = await HandleFirstBoot(path_str, BASEPATH, STATIC_DIR, IS_PROD)

		return new Response(returnstr, {
			status: 200,
			headers: {
				'Content-Type': 'text/html; charset=UTF-8',
				'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
				'View-Name': viewname,
			},
		})
	} catch {
		return new Response("Could not load view: " + path_str, {
			status: 400,
			headers: {
				'Content-Type': 'text/plain; charset=UTF-8',
				'Cache-Control': 'no-store',
			},
		})
	}
}

async function assets_general(req:Request):Promise<Response> {
	const pathname = new URL(req.url).pathname
	const nocache = !pathname.includes("shared_worker.js") // not yet sure why shared_worker is being cached

	return new Promise((resolve) => {
		const headers = new Headers()
		const res = {
			set(name:string, value:string) {
				headers.set(name, value)
			},
			send(body:BodyInit) {
				resolve(new Response(body, { headers }))
			},
			sendFile(path:string) {
				resolve(new Response(Bun.file(path), { headers }))
			},
		}

		HandleAssetFile(pathname, res, BASEPATH, STATIC_DIR, nocache, IS_PROD)
	})
}



// END ROUTES







// app.options("/sse_add_listener", cors());
// app.get("/sse_add_listener",     cors(), sse_add_listener)








// app.get('/v/*restofpath', serveview)










// async function sse_add_listener(req:any, res:any) {
//
//     SSE.Add_Listener(req, res)
// }
