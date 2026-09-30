import * as path_util from "node:path"
import { IS_PROD, ReadDistFile, STATIC_PATH } from "./asset_files_ver2.js"
import { LoadViewAsset } from "./asset_view_ver2.js"
import { LoadComponentAsset } from "./asset_component_ver2.js"
import { LoadThirdPartyAsset } from "./asset_thirdparty_ver2.js"


export type RequestedAssetT = { body:string | Blob, content_type:string }

const CONTENT_TYPES:Record<string, string> = {
	".js": "text/javascript; charset=UTF-8",
	".css": "text/css; charset=UTF-8",
}

// Same path shapes as LazyloadFilePath in lazyloads_ver2.ts.
const VIEW_PATH = /^(?:instance\/)?lazy\/views\/([^/]+)\/\1\.js$/
const COMPONENT_PATH = /^(?:instance\/)?lazy\/components\/([^/]+)\/\1\.js$/
const THIRDPARTY_PATH = /^(?:instance\/)?thirdparty\/[^/]+\.js$/




// asset_path is the requested file relative to the static dir, e.g. "instance/main.css" for /assets/instance/main.css.
// Only .js and .css files are served; anything else returns null. In dist every body is the prebuilt brotli file.
export async function LoadRequestedAsset(asset_path:string):Promise<RequestedAssetT | null> {
	const content_type = CONTENT_TYPES[path_util.extname(asset_path)]
	if (!content_type) return null

	return { body: await load_body(asset_path), content_type }
}




async function load_body(asset_path:string):Promise<string | Blob> {
	if (VIEW_PATH.test(asset_path)) return LoadViewAsset(asset_path, true)
	if (COMPONENT_PATH.test(asset_path)) return LoadComponentAsset(asset_path, true)
	if (THIRDPARTY_PATH.test(asset_path)) return LoadThirdPartyAsset(asset_path, true)

	// Everything else is a plain file: index.css, main.css, instance/main.css, main.js, and in dev also the
	// alwaysload modules main.js imports and the view/component css the dev bundles link to.
	if (!IS_PROD) return Bun.file(STATIC_PATH + asset_path)
	return ReadDistFile(asset_path, true)
}
