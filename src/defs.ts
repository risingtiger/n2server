
export type str = string; export type num = number; export type bool = boolean;

export type GenericRowT = { [key:string]: any }

export type LazyloadDependencyT = {
	type:"view" | "component" | "thirdparty",
	name:string,
}

export type LazyloadT = {
	type:"view" | "component" | "thirdparty",
	urlmatch?:string,
	urlmatch_regex?:RegExp,
	name:string,
	is_instance:boolean,
	dependencies:LazyloadDependencyT[]|null,
	auth:unknown[],
	localdb?:string[],
}

//export const enum SSETriggersE { FIRESTORE, FIRESTORE_DOC_ADD, FIRESTORE_DOC_PATCH, FIRESTORE_DOC_DELETE, FIRESTORE_COLLECTION, CUSTOM }
// ssetriggers are 0:FIRESTORE, 1: FIRESTORE_DOC_ADD, 2: FIRESTORE_DOC_PATCH, 3: FIRESTORE_DOC_DELETE, 4: FIRESTORE_COLLECTION, 5: CUSTOM

export type ServerMainsT = {
	app:any, // Express app instance
	db:any, // Firestore database instance 
	pg:any, // Postgres client instance
	storage:any, // Cloud Storage instance
	ai:any,
	appversion:number, 
	sheets:any, 
	push_subscriptions:any, 
	firestore:any, 
	influxdb:any, 
	emailing:any,
	sse:any, // Server Sent Events manager
	utils:any,
	validate_request:any,
};

export type ServerInstanceT = {
	INSTANCEID:string, 
	PROJECTID:string, 
	KEYJSONFILE:string, 
	IDENTITY_PLATFORM_API:string,
	Set_Server_Mains:(m:ServerMainsT)=>void, 
	Set_Routes:()=>void
}




