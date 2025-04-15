import { Resource, ResourceTemplate } from "@modelcontextprotocol/sdk/types.js";
// TODO: maybe convert to yaml file, if it will grow
// TODO: properly write description for each resource - it should be clear for client what will be returned
export const TREE_RESOURCES: Resource[] = [
  {
    uri: "visual://localhost/tree/root",
    name: "Widget Tree Root",
    description: "Get the root widget of the Flutter application",
    mimeType: "application/json",
  },
  {
    uri: "visual://localhost/app/info",
    name: "App Info",
    description: "Get app information (size of screen, pixel ratio etc.)",
    mimeType: "application/json",
  },
  {
    uri: "visual://localhost/app/errors/latest",
    name: "Latest Application Error",
    description: "Get one latest application error. ",
    mimeType: "application/json",
  },
  {
    uri: "visual://localhost/app/screenshot",
    name: "Screenshot",
    description:
      "Get screenshot of the application. Returns a base64 encoded image in blob format.",
    mimeType: "image/png",
  },
];

export const TREE_RESOURCES_TEMPLATES: ResourceTemplate[] = [
  // {
  //   uriTemplate: "visual://localhost/tree/node/{node_id}",
  //   name: "Widget Node",
  //   description: "Get details of a specific widget node",
  //   mimeType: "application/json",
  // },
  {
    uriTemplate: "visual://localhost/app/errors/{count}",
    name: "Get latest application errors",
    description: "Get certain number of latest application errors",
    mimeType: "application/json",
  },
  // {
  //   uriTemplate: "visual://localhost/tree/parent/{node_id}",
  //   name: "Widget Node Parent",
  //   description: "Get parent of a specific widget node",
  //   mimeType: "application/json",
  // },
  // {
  //   uriTemplate: "visual://localhost/tree/children/{node_id}",
  //   name: "Widget Node Children",
  //   description: "Get children of a specific widget node",
  //   mimeType: "application/json",
  // },
];
