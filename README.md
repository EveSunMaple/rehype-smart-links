[English](README.md) | [中文](README.zh-CN.md)

# rehype-smart-links

A rehype plugin for Astro that adds different styles to internal and external links:

- Internal links (pointing to existing pages): Default style with customizable class
- Internal links (pointing to non-existent pages): Red style with customizable class (similar to Wikipedia's broken links)
- External links: Adds "↗" icon (or custom content) and sets target="\_blank", with customizable class

## Installation

```bash
# npm
npm install rehype-smart-links

# yarn
yarn add rehype-smart-links

# pnpm
pnpm add rehype-smart-links
```

## Usage

### Basic Configuration

Add the plugin to your Astro configuration:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import rehypeSmartLinks from "rehype-smart-links";

export default defineConfig({
  markdown: {
    rehypePlugins: [
      // Basic usage (default settings)
      rehypeSmartLinks,

      // Or with custom options
      [
        rehypeSmartLinks,
        {
          content: { type: "text", value: "↗" },
          internalLinkClass: "internal-link",
          externalLinkClass: "external-link",
          brokenLinkClass: "broken-link",
          contentClass: "external-icon",
          target: "_blank",
          rel: "noopener noreferrer",
          publicDir: "./dist",
          routesFile: "./.smart-links-routes.json",
          includeFileExtensions: ["html", "pdf", "zip"], // Only include specific file types
          includeAllFiles: false // Set to true to include all file types
        }
      ]
    ]
  }
});
```

### Two-Phase Build Process (Recommended)

For accurate detection of valid internal links, a two-phase build process is recommended:

#### Method 1: Using the Built-in CLI Command (Recommended)

rehype-smart-links provides a built-in CLI command to simplify the routes file generation process:

1. Add a build script to your `package.json`:

```json
{
  "scripts": {
    "build:with-routes": "astro build && rehype-smart-links build && astro build"
  }
}
```

2. Run the script to execute the two-phase build:

```bash
npm run build:with-routes
```

This command will:

1. First build your site
2. Use the `rehype-smart-links build` command to scan the build output and generate a routes file
3. Build the site again, this time using the generated routes information

The CLI command supports the following options:

```
Options:
  -d, --dir <path>        Build directory path (default: "./dist")
  -o, --output <path>     Output path for the routes file (default: "./.smart-links-routes.json")
  -a, --all               Include all file types (default: false)
  -e, --extensions <ext>  File extensions to include (default: ["html"])
  -h, --help              Show help information
```

#### Method 2: Using the API Functions

You can also write a custom build script:

1. First build the site and create a routes mapping file:

```js
// In your build script
import { generateRoutesFile } from "rehype-smart-links";

// First perform a preliminary build
await build();

// Then generate a routes file from the build output directory
generateRoutesFile("./dist", "./.smart-links-routes.json", {
  includeAllFiles: true, // Include all file types
  // Or only include specific file types
  includeFileExtensions: ["html", "pdf", "zip"]
});

// Finally perform the final build
await build();
```

2. Add a build script to your `package.json`:

```json
{
  "scripts": {
    "build": "node ./scripts/build-with-routes.js"
  }
}
```

3. Create a build script (e.g., `scripts/build-with-routes.js`):

```js
import { execSync } from "node:child_process";
import { generateRoutesFile } from "rehype-smart-links";

// Phase 1: Initial build
console.log("[PHASE 1] Initial build...");
execSync("astro build", { stdio: "inherit" });

// Generate routes mapping file
console.log("[PHASE 2] Generating routes map...");
generateRoutesFile("./dist", "./.smart-links-routes.json", {
  includeAllFiles: true // Include all file types
});

// Phase 2: Build again with routes information
console.log("[PHASE 3] Final build with routes...");
execSync("astro build", { stdio: "inherit" });

console.log("[SUCCESS] Build complete!");
```

## Customizing Link Structure

In addition to adding classes, you can fully customize the HTML structure of the links:

```js
import rehypeSmartLinks from "rehype-smart-links";

export default defineConfig({
  markdown: {
    rehypePlugins: [
      [
        rehypeSmartLinks,
        {
          wrapperTemplate: (node, type, className) => {
            // Create tooltip wrapper
            if (type === "external") {
              // Example structure for external links
              const tooltip = {
                type: "element",
                tagName: "div",
                properties: {
                  className: ["tooltip"],
                  dataTooltip: "This is an external link"
                },
                children: [node]
              };

              // You can also modify the original node
              if (className) {
                node.properties.className
                  = [...(node.properties.className || []), className];
              }

              return tooltip;
            }
            else if (type === "broken") {
              // Example structure for broken links
              const wrapper = {
                type: "element",
                tagName: "span",
                properties: {
                  className: ["broken-link-wrapper"],
                  dataError: "Page doesn't exist"
                },
                children: [node]
              };

              // Add a warning icon
              node.children.push({
                type: "element",
                tagName: "span",
                properties: { className: ["warning-icon"] },
                children: [{ type: "text", value: "⚠" }]
              });

              return wrapper;
            }

            // Only add class for internal links
            if (className) {
              node.properties.className
                = [...(node.properties.className || []), className];
            }

            return node;
          }
        }
      ]
    ]
  }
});
```

This approach allows you to create completely different HTML structures for different types of links, not just add class names, making it ideal for use with component libraries like DaisyUI and TailwindCSS.

## Styling

Add CSS styles for different link types:

```css
/* Default style for internal links */
.internal-link {
  /* Custom styles */
}

/* External links with icons */
.external-link {
  /* Custom styles */
}
.external-link .external-icon {
  margin-left: 0.25em;
  font-size: 0.75em;
}

/* Style for broken links (similar to Wikipedia) */
.broken-link {
  color: red;
}
```

## Options

| Option                        | Type                                 | Default                         | Description                                           |
| ----------------------------- | ------------------------------------ | ------------------------------- | ----------------------------------------------------- |
| `content`                     | `{ type: string, value: string }`    | `{ type: 'text', value: '↗' }` | Content to add after external links                   |
| `internalLinkClass`           | `string`                             | `'internal-link'`               | Class for internal links to existing pages            |
| `externalLinkClass`           | `string`                             | `'external-link'`               | Class for external links                              |
| `brokenLinkClass`             | `string`                             | `'broken-link'`                 | Class for internal links to non-existent pages        |
| `contentClass`                | `string`                             | `'external-icon'`               | Class for the content element added to external links |
| `target`                      | `string`                             | `'_blank'`                      | Target attribute for external links                   |
| `rel`                         | `string`                             | `'noopener noreferrer'`         | Rel attribute for external links                      |
| `publicDir`                   | `string`                             | `'./dist'`                      | Path to the build output directory                    |
| `routesFile`                  | `string`                             | `'./.smart-links-routes.json'`  | Path to the routes mapping file                       |
| `includeFileExtensions`       | `string[]`                           | `['html']`                      | List of file extensions to include                    |
| `includeAllFiles`             | `boolean`                            | `false`                         | Set to true to include all file types                 |
| `wrapperTemplate`             | `(node, type, className) => Element` | `undefined`                     | Template function for custom link structure           |
| `customInternalLinkTransform` | `(node) => void`                     | `undefined`                     | Custom transform function for internal links          |
| `customExternalLinkTransform` | `(node) => void`                     | `undefined`                     | Custom transform function for external links          |
| `customBrokenLinkTransform`   | `(node) => void`                     | `undefined`                     | Custom transform function for broken links            |

## Advanced Customization

### Using Custom Transform Functions

In addition to `wrapperTemplate`, you can use separate transform functions for finer control:

```js
import rehypeSmartLinks from "rehype-smart-links";

// Example custom transform function for external links
function customExternalLinkTransform(node) {
  // Add custom icon or structure
  node.properties.class = [...(node.properties.class || []), "my-external-link"];
  node.properties.target = "_blank";
  node.properties.rel = "noopener";

  // Add custom SVG icon
  const svgIcon = {
    type: "element",
    tagName: "span",
    properties: { class: "custom-icon" },
    children: [{ type: "text", value: "🔗" }]
  };

  node.children.push(svgIcon);
}

export default {
  markdown: {
    rehypePlugins: [
      [
        rehypeSmartLinks,
        {
          customExternalLinkTransform
        }
      ]
    ]
  }
};
```

### Using with TailwindCSS

```js
// Example using TailwindCSS class names
const tailwindWrapper = (node, type, className) => {
  // Save original link content
  const linkChildren = [...node.children];

  // Clear original link content
  node.children = [];

  if (type === "external") {
    // Add Tailwind class names for external links
    node.properties.className = ["text-blue-500", "hover:text-blue-700", "inline-flex", "items-center", "gap-1"];

    // Add original content
    node.children = [
      ...linkChildren,
      {
        type: "element",
        tagName: "svg",
        properties: {
          className: ["w-4", "h-4"],
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor"
        },
        children: [{
          type: "element",
          tagName: "path",
          properties: {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: "2",
            d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          },
          children: []
        }]
      }
    ];

    return node;
  }
  else if (type === "broken") {
    // Create broken link wrapper
    const wrapper = {
      type: "element",
      tagName: "span",
      properties: {
        className: ["group", "relative", "inline-block"]
      },
      children: [
        {
          ...node,
          properties: {
            ...node.properties,
            className: ["text-red-500", "underline", "underline-offset-2", "decoration-wavy", "decoration-red-500"]
          },
          children: linkChildren
        },
        {
          type: "element",
          tagName: "span",
          properties: {
            className: ["invisible", "group-hover:visible", "absolute", "bottom-full", "left-1/2", "-translate-x-1/2", "bg-red-100", "text-red-800", "text-xs", "px-2", "py-1", "rounded", "whitespace-nowrap"]
          },
          children: [{ type: "text", value: "Page doesn't exist" }]
        }
      ]
    };

    return wrapper;
  }
  else {
    // Add Tailwind class names for internal links
    node.properties.className = ["text-green-600", "hover:text-green-800", "transition-colors"];
    node.children = linkChildren;
    return node;
  }
};
```

## License

MIT
