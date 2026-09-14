import {makeHandler} from './receiver.mjs';
Deno.serve(makeHandler(name=>Deno.env.get(name)));

