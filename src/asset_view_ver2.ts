import { BundleDevFile, IS_PROD, ReadDistFile } from "./asset_files_ver2.js"


const CORE_CSS_LINKS = '<link rel="stylesheet" href="/assets/main.css"><link rel="stylesheet" href="/assets/instance/main.css">'




// path is the view's .js entry relative to the static dir, e.g. "instance/lazy/views/home/home.js".
export async function LoadViewAsset(path:string, get_compressed:boolean):Promise<string | Blob> {
	if (IS_PROD) return ReadDistFile(path, get_compressed)

	// The view and each of its parts render into their own shadow root, so every one links the core css before its own.
	return BundleDevFile(path, (css_url) => `${CORE_CSS_LINKS}<link rel="stylesheet" href="${css_url}">`)
}
