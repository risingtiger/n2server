

type str = string; //type int = number; type bool = boolean;

import { FieldValue } from "@google-cloud/firestore"
import { Firestore } from "firebase-admin/firestore";
import { getMessaging, BatchResponse }  from "firebase-admin/messaging";




const Add_Subscription = (db:Firestore, fcm_token:str, user_email:str) => new Promise<number|null>(async (promise_res, _rej)=> {

    try {
        await db.collection("users").doc(user_email).update( {
            "fcm_token": fcm_token
        })
		promise_res(1)
    } 

    catch (err) { promise_res(null); }
})




const Remove_Subscription = (db:Firestore, user_email:str) => new Promise<number|null>(async (promise_res, _rej)=> {

    try {
        db.collection("users").doc(user_email).update( {
            "fcm_token": FieldValue.delete()
        })
		promise_res(1)
    } 

    catch (err) { promise_res(null); }
})




function Send_Msg(db:Firestore, title:str, body:str, tags:str[]) {

	return new Promise<number>(async (res, rej)=> {

		try {
			const all_user_docs = await db.collection("users").get()
			const all_users = all_user_docs.docs.map((d:any)=> d.data())

			const regtokens:any[] = []
			all_users.forEach((u:any)=> {
				if (!u.fcm_token) { return }
				if (!u.notifications?.tags?.some((t:any)=> tags.includes(t))) { return; }

				if (u.notifications?.alwaysnotify) {
					regtokens.push(u.fcm_token);
					return;
				}

				if (calculate_is_now_within_user_schedules(u)) {
					regtokens.push(u.fcm_token);
				}
			})

			if (regtokens.length === 0) {
				res(1);
				return;
			}

			const message  =  { data: { title, body }, tokens: regtokens }
			const response = await getMessaging().sendEachForMulticast(message)
			handle_multicast_response(response, regtokens)

			res(1)
		} 

		catch (err) { rej(); }
	})
}




function handle_multicast_response(response:BatchResponse, tokens:string[]) {
	response.responses.forEach((result, i) => {
		if (result.success) {
			console.log(`FCM send success for token: ${tokens[i]}`)
			return
		}
		console.log(`FCM send failure for token: ${tokens[i]}`, result.error)
	})
}





function calculate_is_now_within_user_schedules(user:any) {

	if (!user.notifications?.schedules) { return false; }

	const now = Math.floor(Date.now() / 1000);

	for (const schedule of user.notifications.schedules) {
		const user_local_now = now + schedule.timezone_offset;
		const seconds_into_interval = user_local_now % schedule.interval;
		const end = schedule.start + schedule.duration;

		if (end > schedule.interval) { // handles wrap-around intervals (e.g. Sat night to Sun morning)
			if (seconds_into_interval >= schedule.start || seconds_into_interval < (end % schedule.interval)) {
				return true;
			}
		} else {
			if (seconds_into_interval >= schedule.start && seconds_into_interval < end) {
				return true;
			}
		}
	}

	return false;
}




const Notifications = { Add_Subscription, Remove_Subscription, Send_Msg } 

export default Notifications


