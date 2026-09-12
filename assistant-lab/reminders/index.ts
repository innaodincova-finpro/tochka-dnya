import {makeReminderHandler} from './worker.mjs';
Deno.serve(makeReminderHandler(name=>Deno.env.get(name)));
