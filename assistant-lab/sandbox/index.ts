import {makeHandler} from './handler.mjs';
Deno.serve(makeHandler(name=>Deno.env.get(name)));
