# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who use AI agents and need to manage the capabilities and local configuration those agents use.

## Product Purpose

Tools Manager is a local dashboard and CLI for managing AI-agent skills, MCP servers, hooks, and sessions from one place. Success means users can inspect, update, and synchronize these resources without manually editing each agent's configuration.

## Positioning

It brings skills, MCP configuration, hooks, and local agent sessions into one local management workflow across supported agent tools.

## Operating Context

Users work locally while configuring and maintaining AI-agent environments. The web dashboard supports routine management, while the CLI supports scripted and terminal-first workflows.

## Capabilities and Constraints

The product manages agent skills, MCP servers, hooks, sessions, and local port processes. Port management supports macOS/Linux with lsof and requires confirmation before stopping a process. The dashboard binds to the local loopback interface; its data and agent configuration are managed locally.

## Evidence on Hand

The repository contains a working Bun CLI, web dashboard implementation, automated tests, and product documentation. No external customer, benchmark, pricing, or brand claims are established here.

## Product Principles

- Keep agent configuration visible and actionable in one place.
- Make local state and synchronization status easy to inspect.
- Support both dashboard and terminal-first workflows.
- Preserve a local-first operating model.
