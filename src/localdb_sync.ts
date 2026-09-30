import { SendEvent } from "./sse.js"

type KeyT = string | number
type RecordT = { id:KeyT, [key:string]:unknown }

// Wire protocol: keep in sync with n2client/alwaysload/localdb_types.ts.
export type LocalDBChangeT = { store:string } & (
	{ operation:"add" | "update", records:RecordT[] }
	| { operation:"delete", ids:KeyT[] }
)
export type LocalDBOptionsT = {
	// Return an authenticated user/tenant identifier, or null to deny localdb access.
	scope:(req:Request) => string | null | Promise<string | null>
	stores:Record<string, (scope:string, req:Request) => Promise<RecordT[]>>
}

let _options:LocalDBOptionsT | undefined
const _revisions = new Map<string, Map<string, number>>()

// The host application supplies authoritative store readers, not arbitrary client paths.
export function Init(options:LocalDBOptionsT):void {
	_options = options
}

// Used for both the snapshot request and the shared SSE connection.
export async function GetScope(req:Request):Promise<string | undefined> {
	return (await _options?.scope(req)) ?? undefined
}

export async function HandleSnapshot(req:Request):Promise<Response> {
	if (!_options) return json({ error: "LocalDB has not been configured" }, 503)

	const scope = await GetScope(req)
	if (scope === undefined) return json({ error: "LocalDB access denied" }, 403)

	const store = new URL(req.url).searchParams.get("store")
	if (!store || !Object.hasOwn(_options.stores, store)) return json({ error: "Unknown LocalDB store" }, 404)

	const load = _options.stores[store]
	let revision:number
	let records:RecordT[]
	do {
		revision = get_revision(scope, store)
		records = await load(scope, req)
		// A concurrent committed write invalidates this read. Never stamp old data with a
		// newer revision, or the client would discard the corresponding SSE update.
	} while (revision !== get_revision(scope, store))

	return json({ store, revision, records })
}

// Call immediately after the authoritative write commits, before yielding again. Updates
// contain full post-write records (including id); deletes send ids without record bodies.
// No client writes, mutation routes, pending operations, or reconciliation live here.
export function NotifyChanged(scope:string, change:LocalDBChangeT):void {
	if (!_options || !Object.hasOwn(_options.stores, change.store)) throw new Error(`Unknown LocalDB store: ${change.store}`)

	let stores = _revisions.get(scope)
	if (!stores) {
		stores = new Map()
		_revisions.set(scope, stores)
	}
	const revision = get_revision(scope, change.store) + 1
	stores.set(change.store, revision)
	SendEvent("localdb", { ...change, revision }, scope)
}

function get_revision(scope:string, store:string):number {
	return _revisions.get(scope)?.get(store) ?? 0
}

function json(data:unknown, status = 200):Response {
	return Response.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

// Unhandled: distributed writers/processes need shared revisions and pub/sub. Every write
// must publish, and loaders must read the primary database (not a lagging replica). Large
// stores currently use full snapshots, with no pagination. Host authentication and store
// authorization belong in scope/loaders; reconnect on identity changes to renew SSE scope.
