import {makeHandler} from './handler.mjs';
Deno.serve(makeHandler(n=>Deno.env.get(n)));
