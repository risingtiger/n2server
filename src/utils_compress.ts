
import zlib from 'node:zlib'
import { Response } from 'express'






const Send = (datastr: string, res: Response) => new Promise<void>( async (resolve, reject) => {
	
	let result:string|null;

	try         { result = await compress_it(datastr); }
	catch (err) { reject(err); return; }

	res.set('Content-Encoding', 'br');
	res.status(200).send(result)

	resolve();
})



const compress_it = (datastr: string) => new Promise<string>( async (resolve, reject) => {

    zlib.brotliCompress(datastr, {
        params: {
            // [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            // [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
            [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },

    }, (err:any, result:any) => {
		if (err) { reject(err); return; }
		resolve(result);
    })
})




const CompressUtils = { Send }
export { CompressUtils }
