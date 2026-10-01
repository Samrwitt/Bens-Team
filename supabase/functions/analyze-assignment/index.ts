import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAnalysisHandler } from "./handler.js";

Deno.serve(
  createAnalysisHandler({
    createClient,
    getEnv: (name: string) => Deno.env.get(name),
  }),
);
