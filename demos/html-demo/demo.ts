import { parse as json5Parse } from "json5";

import * as jsondiffpatch from "jsondiffpatch/with-text-diffs";

import * as annotatedFormatter from "jsondiffpatch/formatters/annotated";
import * as htmlFormatter from "jsondiffpatch/formatters/html";
import * as jsonpatchFormatter from "jsondiffpatch/formatters/jsonpatch";

import "jsondiffpatch/formatters/styles/annotated.css";
import "jsondiffpatch/formatters/styles/html.css";

declare namespace CodeMirror {
	function fromTextArea(
		host: HTMLTextAreaElement,
		options?: EditorConfiguration,
	): Editor;

	interface EditorConfiguration {
		mode?: string;
		json?: boolean;
		readOnly?: boolean;
		theme?: string;
	}

	interface Editor {
		getValue(): string;
		setValue(content: string): void;
		on(eventName: "change", handler: () => void): void;
		refresh(): void;
		setOption(option: "theme", value: string): void;
		focus(): void;
		execCommand(command: string): void;
	}
}

interface Continent {
	name: string;
	summary: string;
	surface?: number;
	timezone: [number, number];
	demographics: { population: number; largestCities: string[] };
	languages: string[];
	countries: Country[];
	spanishName?: string;
}

interface Country {
	name: string;
	capital?: string;
	independence?: Date;
	population?: number;
}

const colorSchemeIsDark = () => {
	const colorSchemaMeta =
		(
			(document.querySelector(
				'meta[name="color-scheme"]',
			) as HTMLMetaElement) || null
		).content || "default";
	return (
		colorSchemaMeta === "only dark" ||
		(colorSchemaMeta !== "only light" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches)
	);
};

const onColorSchemeChange = (handler: (dark?: boolean) => void) => {
	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", () => {
			handler(colorSchemeIsDark());
		});
	// also detect changes to the meta tag content
	const colorSchemaMeta = document.querySelector(
		'meta[name="color-scheme"]',
	) as HTMLMetaElement;
	if (colorSchemaMeta) {
		const observer = new MutationObserver((mutationsList) => {
			for (const mutation of mutationsList) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "content"
				) {
					handler(colorSchemeIsDark());
				}
			}
		});
		observer.observe(colorSchemaMeta, { attributes: true });
	}
};

document.body.setAttribute(
	"data-theme",
	colorSchemeIsDark() ? "dark" : "light",
);
onColorSchemeChange((dark) => {
	document.body.setAttribute("data-theme", dark ? "dark" : "light");
});

const parseJson = (text: string) => {
	try {
		return JSON.parse(text, jsondiffpatch.dateReviver);
	} catch {
		return json5Parse(text, jsondiffpatch.dateReviver);
	}
};

const getExampleJson = () => {
	const data: Continent = {
		name: "South America",
		summary:
			"South America (Spanish: América del Sur, Sudamérica or  \n" +
			"Suramérica; Portuguese: América do Sul; Quechua and Aymara:  \n" +
			"Urin Awya Yala; Guarani: Ñembyamérika; Dutch: Zuid-Amerika;  \n" +
			"French: Amérique du Sud) is a continent situated in the  \n" +
			"Western Hemisphere, mostly in the Southern Hemisphere, with  \n" +
			"a relatively small portion in the Northern Hemisphere.  \n" +
			"The continent is also considered a subcontinent of the  \n" +
			"Americas.[2][3] It is bordered on the west by the Pacific  \n" +
			"Ocean and on the north and east by the Atlantic Ocean;  \n" +
			"North America and the Caribbean Sea lie to the northwest.  \n" +
			"It includes twelve countries: Argentina, Bolivia, Brazil,  \n" +
			"Chile, Colombia, Ecuador, Guyana, Paraguay, Peru, Suriname,  \n" +
			"Uruguay, and Venezuela. The South American nations that  \n" +
			"border the Caribbean Sea—including Colombia, Venezuela,  \n" +
			"Guyana, Suriname, as well as French Guiana, which is an  \n" +
			"overseas region of France—are also known as Caribbean South  \n" +
			"America. South America has an area of 17,840,000 square  \n" +
			"kilometers (6,890,000 sq mi). Its population as of 2005  \n" +
			"has been estimated at more than 371,090,000. South America  \n" +
			"ranks fourth in area (after Asia, Africa, and North America)  \n" +
			"and fifth in population (after Asia, Africa, Europe, and  \n" +
			"North America). The word America was coined in 1507 by  \n" +
			"cartographers Martin Waldseemüller and Matthias Ringmann,  \n" +
			"after Amerigo Vespucci, who was the first European to  \n" +
			"suggest that the lands newly discovered by Europeans were  \n" +
			"not India, but a New World unknown to Europeans.",

		surface: 17840000,
		timezone: [-4, -2],
		demographics: {
			population: 385742554,
			largestCities: [
				"São Paulo",
				"Buenos Aires",
				"Rio de Janeiro",
				"Lima",
				"Bogotá",
			],
		},
		languages: [
			"spanish",
			"portuguese",
			"english",
			"dutch",
			"french",
			"quechua",
			"guaraní",
			"aimara",
			"mapudungun",
		],
		countries: [
			{
				name: "Argentina",
				capital: "Buenos Aires",
				independence: new Date(1816, 6, 9),
			},
			{
				name: "Bolivia",
				capital: "La Paz",
				independence: new Date(1825, 7, 6),
			},
			{
				name: "Brazil",
				capital: "Brasilia",
				independence: new Date(1822, 8, 7),
			},
			{
				name: "Chile",
				capital: "Santiago",
				independence: new Date(1818, 1, 12),
			},
			{
				name: "Colombia",
				capital: "Bogotá",
				independence: new Date(1810, 6, 20),
			},
			{
				name: "Ecuador",
				capital: "Quito",
				independence: new Date(1809, 7, 10),
			},
			{
				name: "Guyana",
				capital: "Georgetown",
				independence: new Date(1966, 4, 26),
			},
			{
				name: "Paraguay",
				capital: "Asunción",
				independence: new Date(1811, 4, 14),
			},
			{
				name: "Peru",
				capital: "Lima",
				independence: new Date(1821, 6, 28),
			},
			{
				name: "Suriname",
				capital: "Paramaribo",
				independence: new Date(1975, 10, 25),
			},
			{
				name: "Uruguay",
				capital: "Montevideo",
				independence: new Date(1825, 7, 25),
			},
			{
				name: "Venezuela",
				capital: "Caracas",
				independence: new Date(1811, 6, 5),
			},
		],
	};

	const json = [JSON.stringify(data, null, 2)];

	data.summary = data.summary
		.replace("Brazil", "Brasil")
		.replace("also known as", "a.k.a.");
	data.languages[2] = "inglés";
	data.countries.pop();
	data.countries.pop();
	const firstCountry = data.countries[0];
	if (firstCountry) {
		firstCountry.capital = "Rawson";
	}
	data.countries.push({
		name: "Antártida",
	});

	// modify and move
	if (data.countries[4]) {
		data.countries[4].population = 42888594;
	}
	data.countries.splice(11, 0, data.countries.splice(4, 1)[0] as Country);

	data.countries.splice(2, 0, data.countries.splice(7, 1)[0] as Country);

	// biome-ignore lint/performance/noDelete: allowed for demo purposes
	delete data.surface;
	data.spanishName = "Sudamérica";
	data.demographics.population += 2342;

	json.push(JSON.stringify(data, null, 2));

	return json;
};

const diffOptions = {
	objectHash: (obj, index) => {
		if (typeof obj === "object" && obj !== null) {
			const objRecord = obj as Record<string, string>;
			if (typeof objRecord._id !== "undefined") {
				return objRecord._id;
			}
			if (typeof objRecord.id !== "undefined") {
				return objRecord.id;
			}
			if (typeof objRecord.key !== "undefined") {
				return objRecord.key;
			}
			if (typeof objRecord.name !== "undefined") {
				return objRecord.name;
			}
		}
		return `$$index:${index}`;
	},
} as jsondiffpatch.Options;
const instance = jsondiffpatch.create(diffOptions);
const instanceWithNoTextDiff = jsondiffpatch.create({
	...diffOptions,
	textDiff: {
		minLength: Number.MAX_VALUE,
	},
});

const dom = {
	addClass: (el: HTMLElement, className: string) => {
		if (el.classList) {
			el.classList.add(className);
		} else {
			el.className += ` ${className}`;
		}
	},
	removeClass: (el: HTMLElement, className: string) => {
		if (el.classList) {
			el.classList.remove(className);
		} else {
			el.className = el.className.replace(
				new RegExp(`(^|\\b)${className.split(" ").join("|")}(\\b|$)`, "gi"),
				" ",
			);
		}
	},
	text: (el: Element, text: string) => {
		if (typeof el.textContent !== "undefined") {
			if (typeof text === "undefined") {
				return el.textContent;
			}
			el.textContent = text;
		} else if (el instanceof HTMLElement) {
			if (typeof text === "undefined") {
				return el.innerText;
			}
			el.innerText = text;
		} else {
			el.textContent = text;
		}
		return undefined;
	},
	getJson: (
		url: string,
		callback: (error: Error | string | null, data?: unknown) => void,
	) => {
		if (!url.startsWith("https://api.github.com/gists")) {
			return callback(
				null,
				"invalid url, for security reasons only gists are allowed",
			);
		}
		let request: XMLHttpRequest | null = new XMLHttpRequest();
		request.open("GET", url, true);
		request.onreadystatechange = function () {
			if (this.readyState === 4) {
				let data: unknown;
				try {
					data = parseJson(this.responseText);
				} catch (parseError) {
					return callback(`parse error: ${parseError}`);
				}
				if (this.status >= 200 && this.status < 400) {
					callback(null, data);
				} else {
					callback(new Error("request failed"), data);
				}
			}
		};
		request.send();
		request = null;
	},
	runScriptTags: (el: HTMLElement) => {
		const scripts = el.querySelectorAll("script");
		for (const s of scripts) {
			// biome-ignore lint/security/noGlobalEval: this is used to adjust move arrows
			eval(s.innerHTML);
		}
	},
};

const trim = (str: string) => str.replace(/^\s+|\s+$/g, "");

class JsonArea {
	element: HTMLTextAreaElement;
	container: HTMLElement;
	editor?: CodeMirror.Editor;

	constructor(element: HTMLTextAreaElement) {
		this.element = element;
		this.container = element.parentNode as HTMLElement;
		const prettifyButton = this.container.querySelector(
			".reformat",
		) as HTMLElement;
		if (prettifyButton) {
			prettifyButton.addEventListener("click", () => {
				this.reformat();
			});
		}
	}

	error = (err: unknown) => {
		const errorElement = this.container.querySelector(".error-message");
		if (!err) {
			dom.removeClass(this.container, "json-error");
			if (!errorElement) {
				console.error(
					"error element not found in this container",
					this.container,
				);
			} else {
				errorElement.innerHTML = "";
			}
			return;
		}
		if (errorElement) {
			errorElement.innerHTML = `${err}`;
		}
		dom.addClass(this.container, "json-error");
	};

	getValue = () => {
		if (!this.editor) {
			return this.element.value;
		}
		return this.editor.getValue();
	};

	parse = () => {
		const txt = trim(this.getValue());
		try {
			this.error(false);
			if (
				/^\d+(.\d+)?(e[+-]?\d+)?$/i.test(txt) ||
				/^(true|false)$/.test(txt) ||
				/^["].*["]$/.test(txt) ||
				/^[{[](.|\n)*[}\]]$/.test(txt)
			) {
				return parseJson(txt);
			}
			return this.getValue();
		} catch (err) {
			this.error(err);
			throw err;
		}
	};

	setValue = (value: string) => {
		if (!this.editor) {
			this.element.value = value;
			return;
		}
		this.editor.setValue(value);
	};

	reformat = () => {
		const value = this.parse();
		const prettyJson =
			typeof value === "string" ? value : JSON.stringify(value, null, 2);
		this.setValue(prettyJson);
	};

	/* global CodeMirror */
	makeEditor = (readOnly?: boolean) => {
		if (typeof CodeMirror === "undefined") {
			return;
		}

		// Function to get current theme based on browser's interpreted scheme
		const getTheme = () => (colorSchemeIsDark() ? "monokai" : "default");

		const editor = CodeMirror.fromTextArea(this.element, {
			mode: "javascript",
			json: true,
			readOnly,
			theme: getTheme(),
		});
		this.editor = editor;

		onColorSchemeChange(() => {
			editor.setOption("theme", getTheme());
		});

		if (!readOnly) {
			this.editor.on("change", compare);
		}
	};
}

const areas = {
	left: new JsonArea(
		document.getElementById("json-input-left") as HTMLTextAreaElement,
	),
	right: new JsonArea(
		document.getElementById("json-input-right") as HTMLTextAreaElement,
	),
	delta: new JsonArea(
		document.getElementById("json-delta") as HTMLTextAreaElement,
	),
	jsonpatch: new JsonArea(
		document.getElementById("jsonpatch") as HTMLTextAreaElement,
	),
};

const getElementByIdOrThrow = (id: string) => {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`DOM element with id "${id}" not found`);
	}
	return element;
};

const getElementBySelectorOrThrow = (selector: string) => {
	const element = document.querySelector(selector);
	if (!element) {
		throw new Error(`DOM element not found using selector "${selector}"`);
	}
	return element;
};
const compare = () => {
	let left: unknown;
	let right: unknown;
	let error: unknown;
	const resultsSections = getElementByIdOrThrow("results");
	resultsSections.style.display = "none";
	try {
		left = areas.left.parse();
	} catch (err) {
		error = err;
	}
	try {
		right = areas.right.parse();
	} catch (err) {
		error = err;
	}
	areas.delta.error(false);
	areas.jsonpatch.error(false);
	if (error) {
		areas.delta.setValue("");
		areas.jsonpatch.setValue("");
		return;
	}

	const selectedType = getSelectedDeltaType();
	const visualdiff = getElementByIdOrThrow("visualdiff");
	const annotateddiff = getElementByIdOrThrow("annotateddiff");
	const jsondifflength = getElementByIdOrThrow("jsondifflength");
	const jsonpatchlength = getElementByIdOrThrow("jsonpatchlength");
	try {
		// jsonpatch format doesn't support textdiffs
		const noTextDiff = selectedType === "jsonpatch";
		const delta = (noTextDiff ? instanceWithNoTextDiff : instance).diff(
			left,
			right,
		);
		resultsSections.setAttribute(
			"data-diff",
			typeof delta === "undefined" ? "no-diff" : "has-diff",
		);

		if (typeof delta === "undefined") {
			switch (selectedType) {
				case "visual":
					visualdiff.innerHTML = "no diff";
					break;
				case "annotated":
					annotateddiff.innerHTML = "no diff";
					break;
				case "json":
					areas.delta.setValue("no diff");
					jsondifflength.innerHTML = "0";
					break;
				case "jsonpatch":
					areas.jsonpatch.setValue("[]");
					jsonpatchlength.innerHTML = "0";
					break;
			}
		} else {
			switch (selectedType) {
				case "visual":
					visualdiff.innerHTML = htmlFormatter.format(delta, left) ?? "";
					if (
						!(document.getElementById("showunchanged") as HTMLInputElement)
							.checked
					) {
						htmlFormatter.hideUnchanged();
					}
					dom.runScriptTags(visualdiff);
					break;
				case "annotated":
					annotateddiff.innerHTML = annotatedFormatter.format(delta) ?? "";
					break;
				case "json":
					areas.delta.setValue(JSON.stringify(delta, null, 2));
					jsondifflength.innerHTML = `${Math.round(JSON.stringify(delta).length / 102.4) / 10.0}`;
					break;
				case "jsonpatch": {
					const jsonpatch = jsonpatchFormatter.format(delta) ?? [];
					areas.jsonpatch.setValue(prettyJsonPatch(jsonpatch));
					jsonpatchlength.innerHTML = `${Math.round(JSON.stringify(jsonpatch).length / 102.4) / 10.0}`;
					break;
				}
			}
		}
	} catch (err) {
		jsondifflength.innerHTML = "0";
		visualdiff.innerHTML = "";
		annotateddiff.innerHTML = "";
		areas.delta.setValue("");
		areas.delta.error(err);
		areas.jsonpatch.setValue("");
		areas.jsonpatch.error(err);
		if (typeof console !== "undefined" && console.error) {
			console.error(err);
			console.error((err as Error).stack);
		}
		resultsSections.removeAttribute("data-diff");
	}
	getElementByIdOrThrow("results").style.display = "";
};

areas.left.makeEditor();
areas.right.makeEditor();
areas.delta.makeEditor(true);
areas.jsonpatch.makeEditor(true);

areas.left.element.addEventListener("change", compare);
areas.right.element.addEventListener("change", compare);
areas.left.element.addEventListener("keyup", compare);
areas.right.element.addEventListener("keyup", compare);

window.addEventListener("keydown", (e) => {
	if (e.altKey && e.key === "ArrowRight") {
		areas.right.editor?.focus();
		areas.right.editor?.execCommand("selectAll");
	}
	if (e.altKey && e.key === "ArrowLeft") {
		areas.left.editor?.focus();
		areas.left.editor?.execCommand("selectAll");
	}
	if (e.metaKey && e.key === "s") {
		const leftJson = areas.left.getValue();
		const rightJson = areas.right.getValue();
		window.history.pushState(
			{},
			"",
			`?left=${encodeURIComponent(leftJson)}&right=${encodeURIComponent(
				rightJson,
			)}`,
		);
		e.preventDefault();
		e.stopPropagation();
	}
});

const getSelectedDeltaType = () =>
	document.querySelector("#results")?.getAttribute("data-delta-type") ||
	"visual";

const showDeltaType = (type: string) => {
	if (
		type !== "visual" &&
		type !== "annotated" &&
		type !== "json" &&
		type !== "jsonpatch"
	) {
		return false;
	}

	for (const el of document.querySelectorAll(".delta-type-switch li")) {
		el.classList.remove("is-active");
	}
	document
		.querySelector(`[href*="#delta-${type}"]`)
		?.closest("li")
		?.classList.add("is-active");
	document.querySelector("#results")?.setAttribute("data-delta-type", type);

	compare();
	if (type === "json") {
		areas.delta.editor?.refresh();
	}
	if (type === "jsonpatch") {
		areas.jsonpatch.editor?.refresh();
	}
	return true;
};

for (const el of document.querySelectorAll(".delta-type-switch a")) {
	el.addEventListener("click", (e) => {
		const match = /#delta-(.+)$/.exec((e.target as HTMLAnchorElement)?.href);
		if (!match) return;
		const deltaType = match[1];
		if (deltaType && showDeltaType(deltaType)) {
			e.preventDefault();
		}
	});
}

getElementByIdOrThrow("swap").addEventListener("click", () => {
	const leftValue = areas.left.getValue();
	areas.left.setValue(areas.right.getValue());
	areas.right.setValue(leftValue);
	compare();
});

getElementByIdOrThrow("clear").addEventListener("click", () => {
	areas.left.setValue("");
	areas.right.setValue("");
	compare();
});

getElementByIdOrThrow("showunchanged").addEventListener("change", () => {
	htmlFormatter.showUnchanged(
		(document.getElementById("showunchanged") as HTMLInputElement).checked,
		null,
		800,
	);
});

document.addEventListener("DOMContentLoaded", () => {
	setTimeout(compare);
});

interface DataObject {
	name?: string;
	content?: string;
	fullname?: string;
}

interface Data {
	url?: string;
	description?: string;
	left?: DataObject | string;
	right?: DataObject | string;
	error?: unknown;
}

interface Load {
	data: (dataArg?: Data) => void;
	gist: (this: Load, id: string, onSuccess?: (gist: GistData) => void) => void;
	leftright: (
		this: Load,
		descriptionArg: string | undefined,
		leftValueArg: string,
		rightValueArg: string,
	) => void;
	example: (id: string) => void;
	key: (key: string) => void;
}

const loadExampleById = (id: string) => {
	switch (id) {
		case "text": {
			const exampleJson = getExampleJson();
			load.data({
				left: {
					name: "left.txt",
					content: JSON.parse(exampleJson[0] ?? "{}").summary,
				},
				right: {
					name: "right.txt",
					content: JSON.parse(exampleJson[1] ?? "{}").summary,
				},
			});
			break;
		}
		case "gist":
			document.location = "?benjamine/9188826";
			break;
		case "moving":
			document.location = `?desc=moving%20around&left=${encodeURIComponent(
				JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
			)}&right=${encodeURIComponent(
				JSON.stringify([10, 0, 1, 7, 2, 4, 5, 6, 88, 9, 3]),
			)}`;
			break;
		case "query":
			document.location = `?desc=encoded%20in%20url&left=${encodeURIComponent(
				JSON.stringify({
					"don't": "abuse",
					with: ["large", "urls"],
				}),
			)}&right=${encodeURIComponent(
				JSON.stringify({
					"don't": "use",
					with: [">", 2, "KB urls"],
				}),
			)}`;
			break;
		default:
			document.location = "?";
			break;
	}
};

const load: Load = {
	data: (dataArg) => {
		const data = dataArg || {};
		dom.text(getElementByIdOrThrow("description"), data.description || "");
		if (data.url && trim(data.url).substring(0, 10) !== "javascript") {
			getElementByIdOrThrow("external-link").setAttribute("href", data.url);
			getElementByIdOrThrow("external-link").style.display = "";
		} else {
			getElementByIdOrThrow("external-link").style.display = "none";
		}
		const leftValue = data.left
			? (data.left as DataObject).content || (data.left as string)
			: "";
		areas.left.setValue(leftValue);
		const rightValue = data.right
			? (data.right as DataObject).content || (data.right as string)
			: "";
		areas.right.setValue(rightValue);

		dom.text(
			getElementBySelectorOrThrow("#json-panel-left h2"),
			(data.left && (data.left as DataObject).name) || "left.json",
		);
		dom.text(
			getElementBySelectorOrThrow("#json-panel-right h2"),
			(data.right && (data.right as DataObject).name) || "right.json",
		);

		getElementBySelectorOrThrow("#json-panel-left h2").setAttribute(
			"title",
			(data.left && (data.left as DataObject).fullname) || "",
		);
		getElementBySelectorOrThrow("#json-panel-right h2").setAttribute(
			"title",
			(data.right && (data.right as DataObject).fullname) || "",
		);

		if (data.error) {
			areas.left.setValue(`ERROR LOADING: ${data.error}`);
			areas.right.setValue("");
		}
	},

	gist: (id, onSuccess) => {
		dom.getJson(`https://api.github.com/gists/${id}`, (error, data) => {
			interface GistError {
				message?: string;
			}

			if (error) {
				const gistError = data as GistError;
				const message = error + (gistError?.message ? gistError.message : "");
				load.data({
					error: message,
				});
				return;
			}

			const gistData = data as GistData;

			const files: GistData["files"][string][] = [];

			for (const filename in gistData.files) {
				const file = gistData.files[filename];
				if (file && /^json[5c]?$/i.test(file.language)) {
					files.push(file);
				}
			}

			if (files.length < 1) {
				load.data({
					error: "no JSON files found in this gist",
				});
				return;
			}
			if (files.length < 2) {
				files.push({
					language: "JSON",
					filename: "missing.json",
					content: '"only 1 JSON files found in the gist, need 2 to compare"',
				});
			}
			/* jshint camelcase: false */
			load.data({
				url: gistData.html_url,
				description: gistData.description,
				left: {
					name: files[0]?.filename,
					content: files[0]?.content,
				},
				right: {
					name: files[1]?.filename,
					content: files[1]?.content,
				},
			});

			onSuccess?.(gistData);
		});
	},

	leftright: (descriptionArg, leftValueArg, rightValueArg) => {
		try {
			const description = decodeURIComponent(descriptionArg || "");
			const leftValue = decodeURIComponent(leftValueArg);
			const rightValue = decodeURIComponent(rightValueArg);
			const urlregex = /https?:\/\/.*\/([^/]+\.json)(?:[?#].*)?/;
			const dataLoaded: {
				description: string;
				left: DataObject;
				right: DataObject;
			} = {
				description,
				left: {},
				right: {},
			};
			const loadIfReady = () => {
				if (
					typeof dataLoaded.left.content !== "undefined" &&
					typeof dataLoaded.right.content !== "undefined"
				) {
					load.data(dataLoaded);
				}
			};
			const urlmatchLeft = urlregex.exec(leftValue);
			if (urlmatchLeft) {
				dataLoaded.left.name = urlmatchLeft[1];
				dataLoaded.left.fullname = leftValue;
				dom.getJson(leftValue, (error, data) => {
					if (error) {
						dataLoaded.left.content =
							error +
							(data && (data as { message?: string }).message
								? (data as { message: string }).message
								: "");
					} else {
						dataLoaded.left.content = JSON.stringify(data, null, 2);
					}
					loadIfReady();
				});
			} else {
				dataLoaded.left.content = leftValue;
			}

			const urlmatchRight = urlregex.exec(leftValue);
			if (urlmatchRight) {
				dataLoaded.right.name = urlmatchRight[1];
				dataLoaded.right.fullname = rightValue;
				dom.getJson(rightValue, (error, data) => {
					if (error) {
						dataLoaded.right.content =
							error +
							(data && (data as { message?: string }).message
								? (data as { message: string }).message
								: "");
					} else {
						dataLoaded.right.content = JSON.stringify(data, null, 2);
					}
					loadIfReady();
				});
			} else {
				dataLoaded.right.content = rightValue;
			}
			loadIfReady();
		} catch (err) {
			load.data({
				error: err,
			});
		}
	},

	example: (arg: string) => {
		const id = decodeURIComponent(arg || "");
		loadExampleById(id);
	},

	key: (key: string) => {
		const matchers = {
			gist: /^(?:https?:\/\/)?(?:gist\.github\.com\/)?(?:[\w0-9\-a-f]+\/)?([0-9a-f]+)$/i,
			leftright: /^(?:desc=(.*)?&)?left=(.*)&right=(.*)&?$/i,
			example: /^example=([\w\d\-_/]+)$/i,
		};
		for (const loader in matchers) {
			const match = matchers[loader as keyof typeof matchers].exec(key);
			if (match) {
				return (
					load[loader as keyof typeof matchers] as (
						this: Load,
						...args: string[]
					) => void
				).apply(load, match.slice(1));
			}
		}

		// no matches, just load the default example
		const exampleJson = getExampleJson();
		load.data({
			left: exampleJson[0],
			right: exampleJson[1],
		});
	},
};

const urlQuery = /^[^?]*\?([^#]+)/.exec(document.location.href);
if (urlQuery?.[1]) {
	load.key(urlQuery[1]);
} else {
	const exampleJson = getExampleJson();
	load.data({
		left: exampleJson[0],
		right: exampleJson[1],
	});
}

interface GistData {
	id: string;
	files: Record<
		string,
		{ language: string; filename: string; content: string }
	>;
	html_url: string;
	description: string;
	owner: { login: string };
}

document.querySelector("#gist_url")?.addEventListener("input", (e) => {
	const match =
		/^(?:https?:\/\/)?gist\.github\.com\/([^/]+)\/([0-9a-f]+)/i.exec(
			(e.target as HTMLInputElement).value,
		);
	if (!match || !match[2]) return;
	load.gist(match[2], (gist) => {
		window.history.pushState({}, "", `?${gist.owner.login}/${gist.id}`);
		document.querySelector("h1")?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
		const input = document.querySelector("#gist_url") as HTMLInputElement;
		if (input) {
			input.value = "";
			input.blur();
		}
	});
});

const prettyJsonPatch = (patch: jsonpatchFormatter.Op[]) => {
	if (patch.length === 0) {
		return "[]";
	}
	const lines = patch.map((op, index) => {
		const opPad = "".padStart(Math.max(0, 7 - op.op.length), " ");
		const extraProps = Object.keys(op)
			.filter((key) => !["op", "path"].includes(key))
			.map((key) => {
				const value =
					key in op ? op[key as keyof jsonpatchFormatter.Op] : undefined;
				if (value === undefined) return "";
				return `, ${JSON.stringify(key)}: ${JSON.stringify(value)}`;
			})
			.join("");
		return `  { "op": "${op.op}",${opPad} "path": "${op.path}"${extraProps} }${
			index < patch.length - 1 ? "," : ""
		}\n`;
	});
	return `[\n${lines.join("")}]`;
};
