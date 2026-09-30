import { BundleDevFile, IS_PROD, ReadDistFile } from "./asset_files_ver2.js"




// path is the thirdparty file relative to the static dir, e.g. "thirdparty/lit-html.js".
// Dist thirdparty files are raw ESM (minified, not bundled), so their exports are kept.
// Unhandled Case: a dist thirdparty file with relative imports breaks, since dist does not bundle them.
export async function LoadThirdPartyAsset(path:string, get_compressed:boolean):Promise<string | Blob> {
	if (IS_PROD) return ReadDistFile(path, get_compressed)

	// Thirdparty files have no {--html--}/{--css--} placeholders; bundling only resolves their relative imports.
	return BundleDevFile(path, () => "")
}
