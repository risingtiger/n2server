// Only used to resolve relative URLs for parsing; no requests go to this origin.
// A /Users/<name>/ basepath indicates macOS; otherwise use the incoming server origin.
export function URLBase(basepath:string, request_url:string):string {
	if (/^\/Users\/[^/]+\//.test(basepath)) return "http://localhost/"
	return new URL(request_url).origin + "/"
}
