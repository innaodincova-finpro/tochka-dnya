import {makeHandler} from './receiver.mjs';
import {BUILD_VERSION} from './build-info.mjs';
Deno.serve(makeHandler(name=>Deno.env.get(name),fetch,undefined,undefined,BUILD_VERSION));
