import {makeHandler} from './control.mjs';
Deno.serve(makeHandler(name=>Deno.env.get(name),fetch));
