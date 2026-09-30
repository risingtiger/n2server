import { STATIC_PATH } from "./asset_files_ver2.js"


const ASSET_TAGS = [
	'<link rel="stylesheet" href="/assets/index.css">',
	'<link rel="stylesheet" href="/assets/main.css">',
	'<link rel="stylesheet" href="/assets/instance/main.css">',
	'<script type="module" src="/assets/main.js"></script>',
].join("\n")




// Serves /assets/index.html in both modes and every dev page load ("/", "/v/..."), with identical output.
// The view is not included; the client lazy loads it and its data. The linked files are served through /assets/.
export async function BuildWarmLoadPage():Promise<string> {
	const indexhtml = await Bun.file(STATIC_PATH + "instance/index.html").text()
	return indexhtml.replace("<!--{--js_css--}-->", () => ASSET_TAGS)
}
