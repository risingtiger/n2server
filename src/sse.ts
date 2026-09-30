const encoder = new TextEncoder()
const listeners = new Map<ReadableStreamDefaultController<Uint8Array>, string | undefined>()


export function AddListener(req:Request, localdb_scope?:string):Response {
	let heartbeat:ReturnType<typeof setInterval>
	let controller:ReadableStreamDefaultController<Uint8Array>

	function cleanup() {
		clearInterval(heartbeat)
		listeners.delete(controller)
		req.signal.removeEventListener("abort", on_abort)
	}

	function on_abort() {
		cleanup()
		controller.close()
	}

	const stream = new ReadableStream<Uint8Array>({
		start(stream_controller) {
			controller = stream_controller
			listeners.set(controller, localdb_scope)
			controller.enqueue(encoder.encode(": connected\nretry: 15000\n\n"))
			// Stay below Bun's default 10-second idle timeout.
			heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 5000)
			req.signal.addEventListener("abort", on_abort, { once: true })
		},
		cancel: cleanup,
	})

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream; charset=UTF-8",
			"Cache-Control": "no-cache, no-transform",
			"Connection": "keep-alive",
		},
	})
}


// Publish resource keys after the corresponding write commits. No record data is sent.
// Unhandled Case: scope listeners by authenticated tenant before broadcasting tenant-specific keys.
// Unhandled Case: distribute notifications between server processes when running multiple instances.
export function NotifyChanged(paths:string[]):void {
	if (!paths.length) return

	SendEvent("changed", paths)
}


// Separate named protocols can share the connection. Only the legacy changed event
// broadcasts without a scope; localdb record data always supplies an authenticated scope.
export function SendEvent(event:string, data:unknown, scope?:string):void {
	const message = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
	for (const [listener, listener_scope] of listeners) {
		if (scope !== undefined && listener_scope !== scope) continue
		listener.enqueue(message)
	}
}
