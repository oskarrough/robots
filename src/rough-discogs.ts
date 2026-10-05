#!/usr/bin/env bun
// rough-discogs: a thin Discogs CLI. Reads the personal access token from DISCOGS_TOKEN.
//   rough-discogs search QUERY [--type release|master] [--limit N]   QUERY is a barcode, catno or free text
//   rough-discogs release ID                                         summary of one release, to check a link
//   rough-discogs add ID [--folder N]                                add a release to the collection (default folder 1, Uncategorized)
// Searching by barcode or catno is reliable; free text is noisy, so check the printed label/catno/year.

const token = process.env.DISCOGS_TOKEN
if (!token) die("DISCOGS_TOKEN is not set (Discogs → Settings → Developers → personal access token)")

const API = "https://api.discogs.com"
const headers = { Authorization: `Discogs token=${token}`, "User-Agent": "rough-discogs/1.0" }

async function api(path: string, init: RequestInit = {}): Promise<any> {
	const res = await fetch(API + path, { ...init, headers })
	if (res.status === 429) die("rate limited, wait a minute")
	const body = await res.json().catch(() => ({}))
	if (!res.ok) die(`${res.status} ${(body as any).message ?? res.statusText}`)
	return body
}

function die(msg: string): never {
	console.error(msg)
	process.exit(1)
}

function flag(args: string[], name: string): string | undefined {
	const i = args.indexOf(`--${name}`)
	if (i === -1) return undefined
	return args.splice(i, 2)[1]
}

const [cmd, ...rest] = process.argv.slice(2)

if (cmd === "search") {
	const type = flag(rest, "type") ?? "release"
	const limit = flag(rest, "limit") ?? "8"
	const q = rest.join(" ")
	if (!q) die("usage: rough-discogs search QUERY")
	const isCode = /^[\dA-Za-z -]+$/.test(q) && /\d/.test(q) && !q.includes(" ")
	const params = new URLSearchParams({ type, per_page: limit })
	// Pure digits are a barcode; a single token with digits is more likely a catno.
	if (/^\d{8,14}$/.test(q.replace(/\s/g, ""))) params.set("barcode", q.replace(/\s/g, ""))
	else if (isCode) params.set("catno", q)
	else params.set("q", q)
	const data = await api(`/database/search?${params}`)
	if (!data.results?.length) console.log("no results")
	for (const r of data.results ?? []) {
		console.log(`${r.id}\t${r.title}\t${[r.label?.[0], r.catno, r.format?.join("+"), r.year, r.country].filter(Boolean).join(" | ")}\t${r.uri ? "https://www.discogs.com" + r.uri : ""}`)
	}
} else if (cmd === "release") {
	const id = rest[0]
	if (!id) die("usage: rough-discogs release ID")
	const r = await api(`/releases/${id}`)
	const artists = r.artists?.map((a: any) => a.name).join(", ")
	const labels = r.labels?.map((l: any) => `${l.name} ${l.catno}`).join("; ")
	const formats = r.formats?.map((f: any) => [f.qty && f.qty !== "1" ? f.qty + "×" : "", f.name, ...(f.descriptions ?? []), f.text].filter(Boolean).join(" ")).join("; ")
	const barcodes = r.identifiers?.filter((i: any) => i.type === "Barcode").map((i: any) => i.value).join(", ")
	console.log(`${artists} – ${r.title}\n${labels}\n${formats}\n${r.year ?? "?"} ${r.country ?? ""}\nbarcode: ${barcodes || "-"}\n${r.uri}`)
} else if (cmd === "add") {
	const folder = flag(rest, "folder") ?? "1"
	const id = rest[0]
	if (!id) die("usage: rough-discogs add ID")
	const me = await api("/oauth/identity")
	const r = await api(`/users/${me.username}/collection/folders/${folder}/releases/${id}`, { method: "POST" })
	console.log(`added ${id} to folder ${folder} (instance ${r.instance_id})`)
} else {
	die("usage: rough-discogs search|release|add ...")
}
