import { BundleDevFile, IS_PROD, ReadDistFile } from "./asset_files_ver2.js"




// path is the component's .js entry relative to the static dir, e.g. "lazy/components/btn/btn.js".
// Only this component and its relative imports are returned; its declared dependencies load separately.
export async function LoadComponentAsset(path:string, get_compressed:boolean):Promise<string | Blob> {
	if (IS_PROD) return ReadDistFile(path, get_compressed)

	// Components link only their own css (kept as a link for Chrome css overrides), never the core css.
	return BundleDevFile(path, (css_url) => `<link rel="stylesheet" href="${css_url}">`)
}
