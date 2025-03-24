bootstrap:
	cd forwarding_server && npm install && npm run build
	cd mcp_server && npm install && npm run build
	cd devtools_mcp_extension && npm install && npm run build