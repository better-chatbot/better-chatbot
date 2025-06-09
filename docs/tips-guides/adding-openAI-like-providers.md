# Adding openAI like provider 
## What is an openAI like provider
It is an api that is like the openAI one. They are used as llm providers.
## Adding providers - docker and local deployment - file method
1. Set up the app as you normally would
2. Open `.openAILike.ts` in an IDE
3. Uncomment the example and remove the word example
4. Modify the api url and other data to match your provider - to add more just copy and paste it and edit it
5. Edit env variables the api key should be in your env - it should be named what you called it in the file
6. Run `pnpm openai-compatiable:parse` to update env when you change schema
## Adding providers - vercel or anywhere else - ui based method
1. Go to [this website](https://mcp-client-chatbot-openai-like.vercel.app/)
2. Press generate JSON and copy it
3. Put in this into your env as the `OPENAI_LIKE_DATA` variable
4. Add the env variables you defined for provider secrets
### Editing 
Copy the contents of the env into the import section at the top, then regenerate and update your env