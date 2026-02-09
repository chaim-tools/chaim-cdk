#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const activator_stack_1 = require("../src/activator-stack");
const app = new cdk.App();
const apiBaseUrl = app.node.tryGetContext('apiBaseUrl') || process.env.CHAIM_API_BASE_URL || '';
const apiKey = app.node.tryGetContext('apiKey') || process.env.CHAIM_API_KEY || '';
const apiSecret = app.node.tryGetContext('apiSecret') || process.env.CHAIM_API_SECRET || '';
const schemaHandlerPackageS3Uri = app.node.tryGetContext('schemaHandlerPackageS3Uri') || process.env.CHAIM_SCHEMA_HANDLER_PACKAGE_S3_URI;
if (!apiBaseUrl || !apiKey || !apiSecret) {
    throw new Error('Missing required parameters: apiBaseUrl, apiKey, and apiSecret are required. Set via CDK context (--context) or environment variables.');
}
new activator_stack_1.ActivatorStack(app, 'ChaimActivatorStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    apiBaseUrl,
    apiKey,
    apiSecret,
    schemaHandlerPackageS3Uri,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aXZhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWN0aXZhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw0REFBd0Q7QUFFeEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxFQUFFLENBQUM7QUFDaEcsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksRUFBRSxDQUFDO0FBQ25GLE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLElBQUksRUFBRSxDQUFDO0FBQzVGLE1BQU0seUJBQXlCLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsMkJBQTJCLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDO0FBRXpJLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxTQUFTLEVBQUU7SUFDeEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx3SUFBd0ksQ0FBQyxDQUFDO0NBQzNKO0FBRUQsSUFBSSxnQ0FBYyxDQUFDLEdBQUcsRUFBRSxxQkFBcUIsRUFBRTtJQUM3QyxHQUFHLEVBQUU7UUFDSCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCO0tBQ3ZDO0lBQ0QsVUFBVTtJQUNWLE1BQU07SUFDTixTQUFTO0lBQ1QseUJBQXlCO0NBQzFCLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBBY3RpdmF0b3JTdGFjayB9IGZyb20gJy4uL3NyYy9hY3RpdmF0b3Itc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG5jb25zdCBhcGlCYXNlVXJsID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnYXBpQmFzZVVybCcpIHx8IHByb2Nlc3MuZW52LkNIQUlNX0FQSV9CQVNFX1VSTCB8fCAnJztcbmNvbnN0IGFwaUtleSA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2FwaUtleScpIHx8IHByb2Nlc3MuZW52LkNIQUlNX0FQSV9LRVkgfHwgJyc7XG5jb25zdCBhcGlTZWNyZXQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhcGlTZWNyZXQnKSB8fCBwcm9jZXNzLmVudi5DSEFJTV9BUElfU0VDUkVUIHx8ICcnO1xuY29uc3Qgc2NoZW1hSGFuZGxlclBhY2thZ2VTM1VyaSA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3NjaGVtYUhhbmRsZXJQYWNrYWdlUzNVcmknKSB8fCBwcm9jZXNzLmVudi5DSEFJTV9TQ0hFTUFfSEFORExFUl9QQUNLQUdFX1MzX1VSSTtcblxuaWYgKCFhcGlCYXNlVXJsIHx8ICFhcGlLZXkgfHwgIWFwaVNlY3JldCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyczogYXBpQmFzZVVybCwgYXBpS2V5LCBhbmQgYXBpU2VjcmV0IGFyZSByZXF1aXJlZC4gU2V0IHZpYSBDREsgY29udGV4dCAoLS1jb250ZXh0KSBvciBlbnZpcm9ubWVudCB2YXJpYWJsZXMuJyk7XG59XG5cbm5ldyBBY3RpdmF0b3JTdGFjayhhcHAsICdDaGFpbUFjdGl2YXRvclN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OLFxuICB9LFxuICBhcGlCYXNlVXJsLFxuICBhcGlLZXksXG4gIGFwaVNlY3JldCxcbiAgc2NoZW1hSGFuZGxlclBhY2thZ2VTM1VyaSxcbn0pO1xuXG4iXX0=