import type { Element, Root } from "hast";
import type { VFile } from "vfile";

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { isElement } from "hast-util-is-element";
import { visit } from "unist-util-visit";

// 终端颜色
const colors = {
  reset: "\x1B[0m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  dim: "\x1B[2m",
  bold: "\x1B[1m",
};

interface RehypeSmartLinksOptions {
  content?: {
    type: string;
    value: string;
  };
  internalLinkClass?: string;
  externalLinkClass?: string;
  brokenLinkClass?: string;
  contentClass?: string;
  target?: string;
  rel?: string;
  publicDir?: string;
  routesFile?: string;
  includeFileExtensions?: string[];
  includeAllFiles?: boolean;
  wrapperTemplate?: (
    node: Element,
    type: "internal" | "external" | "broken",
    className?: string
  ) => Element;
  customInternalLinkTransform?: (node: Element) => void;
  customExternalLinkTransform?: (node: Element) => void;
  customBrokenLinkTransform?: (node: Element) => void;
}

const defaultOptions: RehypeSmartLinksOptions = {
  content: { type: "text", value: "↗" },
  internalLinkClass: "internal-link",
  externalLinkClass: "external-link",
  brokenLinkClass: "broken-link",
  contentClass: "external-icon",
  target: "_blank",
  rel: "noopener noreferrer",
  publicDir: "./dist",
  routesFile: "./.smart-links-routes.json",
  includeFileExtensions: ["html"],
  includeAllFiles: false,
};

/**
 * Helper function to safely add a class to a node's properties
 */
function addClass(node: Element, className: string | undefined): void {
  if (!className)
    return;

  const currentClasses = node.properties?.className;

  if (!currentClasses) {
    node.properties.className = [className];
  }
  else if (Array.isArray(currentClasses)) {
    node.properties.className = [...currentClasses, className];
  }
  else if (typeof currentClasses === "string") {
    node.properties.className = [currentClasses, className];
  }
  else {
    // For any other type, just set it directly
    node.properties.className = [className];
  }
}

/**
 * Normalizes path for comparison
 */
function normalizePath(path: string): string {
  // Remove leading and trailing slashes
  path = path.replace(/^\/|\/$/g, "");

  // Handle empty path as index
  if (path === "")
    return "index";

  // Handle trailing /index
  if (path.endsWith("/index")) {
    path = path.slice(0, -6);
  }

  return path;
}

/**
 * Recursively scans a directory to find all supported files
 * @param dir Directory to scan
 * @param basePath Base path for routes
 * @param routes Set to collect routes
 * @param options Plugin options
 */
function scanDirectoryForRoutes(
  dir: string,
  basePath: string = "",
  routes: Set<string> = new Set(),
  options: RehypeSmartLinksOptions = defaultOptions,
): Set<string> {
  if (!existsSync(dir)) {
    console.log(`${colors.yellow}[WARNING]${colors.reset} Directory not found: ${colors.bold}${dir}${colors.reset}`);
    return routes;
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  console.log(`${colors.dim}[SCAN]${colors.reset} Scanning directory: ${colors.bold}${dir}${colors.reset} (${entries.length} entries)`);

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      // Add the directory as a route (for directory index)
      const dirRoute = normalizePath(relativePath);
      routes.add(dirRoute);
      console.log(`${colors.blue}[DIR]${colors.reset} Added directory route: ${colors.bold}${dirRoute}${colors.reset}`);

      // Recursively scan subdirectories
      scanDirectoryForRoutes(fullPath, relativePath, routes, options);
    }
    else if (entry.isFile()) {
      const extension = extname(entry.name).slice(1).toLowerCase();

      // Check if we should include this file based on extension
      const shouldInclude = options.includeAllFiles
        || !options.includeFileExtensions
        || options.includeFileExtensions.includes(extension);

      if (shouldInclude) {
        let route = relativePath;

        // Special case for HTML files - remove .html extension if configured
        if (extension === "html" && options.includeFileExtensions?.includes("html")) {
          route = relativePath.replace(/\.html$/, "");

          // Handle index.html files
          if (entry.name === "index.html") {
            route = basePath;
          }
        }

        const normalizedRoute = normalizePath(route);
        routes.add(normalizedRoute);
        console.log(`${colors.green}[FILE]${colors.reset} Added route: ${colors.bold}${normalizedRoute}${colors.reset} (${extension})`);
      }
      else {
        console.log(`${colors.dim}[SKIP]${colors.reset} Skipped file: ${colors.dim}${relativePath}${colors.reset} (${extension})`);
      }
    }
  }

  return routes;
}

/**
 * Generates a routes file by scanning a build directory
 * @param buildDir The build output directory to scan
 * @param routesFilePath Path to save the routes file
 * @param options Additional scan options
 */
export function generateRoutesFile(
  buildDir: string = "./dist",
  routesFilePath: string = "./.smart-links-routes.json",
  options: RehypeSmartLinksOptions = {},
): void {
  console.log(`${colors.cyan}[INFO]${colors.reset} ${colors.bold}Smart Links Route Generation${colors.reset}`);
  console.log(`${colors.cyan}[INFO]${colors.reset} Scanning build directory: ${colors.bold}${buildDir}${colors.reset}`);

  const scanOptions = {
    ...defaultOptions,
    ...options,
  };

  // Log scan settings
  console.log(`${colors.cyan}[CONFIG]${colors.reset} Include all files: ${colors.bold}${scanOptions.includeAllFiles ? "Yes" : "No"}${colors.reset}`);
  if (!scanOptions.includeAllFiles && scanOptions.includeFileExtensions) {
    console.log(`${colors.cyan}[CONFIG]${colors.reset} Included extensions: ${colors.bold}${scanOptions.includeFileExtensions.join(", ")}${colors.reset}`);
  }

  const routes = scanDirectoryForRoutes(buildDir, "", new Set(), scanOptions);

  // Always ensure '/' route is included
  routes.add("index");
  routes.add("");
  console.log(`${colors.blue}[ROUTE]${colors.reset} Added default route: ${colors.bold}/${colors.reset}`);

  console.log(`${colors.cyan}[SUMMARY]${colors.reset} Found ${colors.bold}${routes.size}${colors.reset} routes in the build directory`);

  try {
    writeFileSync(routesFilePath, JSON.stringify(Array.from(routes), null, 2));
    console.log(`${colors.green}[SUCCESS]${colors.reset} Routes file generated: ${colors.bold}${routesFilePath}${colors.reset}`);
  }
  catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to write routes file: ${colors.bold}${error instanceof Error ? error.message : String(error)}${colors.reset}`);
  }
}

/**
 * Loads routes from a routes file
 * @param routesFilePath Path to the routes file
 * @returns A Set of normalized routes
 */
function loadRoutesFromFile(routesFilePath: string): Set<string> {
  const routes = new Set<string>();

  // Always ensure base routes are included
  routes.add("index");
  routes.add("");

  if (!existsSync(routesFilePath)) {
    console.log(`${colors.yellow}[WARNING]${colors.reset} Routes file not found: ${colors.bold}${routesFilePath}${colors.reset}`);
    return routes;
  }

  try {
    const routesData = readFileSync(routesFilePath, "utf-8");
    const parsedRoutes = JSON.parse(routesData) as string[];

    for (const route of parsedRoutes) {
      routes.add(normalizePath(route));
    }
  }
  catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to load routes file: ${colors.bold}${error instanceof Error ? error.message : String(error)}${colors.reset}`);
  }

  return routes;
}

/**
 * Creates a wrapped element according to template
 * @param node Original link element
 * @param type Link type
 * @param className Class name to apply
 * @param options Plugin options
 * @returns Modified element
 */
function processLinkNode(
  node: Element,
  type: "internal" | "external" | "broken",
  className: string | undefined,
  options: RehypeSmartLinksOptions,
): void {
  // Apply custom wrapper template if provided
  if (options.wrapperTemplate) {
    const wrappedNode = options.wrapperTemplate(node, type, className);

    // Replace properties of the original node with the wrapped one
    Object.assign(node, wrappedNode);
  }
  else {
    // Default behavior - just add the class
    if (className) {
      addClass(node, className);
    }
  }
}

/**
 * Rehype plugin to add different styling to internal and external links.
 * For external links, it adds an arrow icon and sets target="_blank".
 * For internal links, it checks if the path exists and styles broken links differently.
 */
export default function rehypeSmartLinks(options: RehypeSmartLinksOptions = {}) {
  const opts = { ...defaultOptions, ...options };

  return (tree: Root, file: VFile) => {
    // Get the site URL and routes from Astro if available
    const siteUrl = (file.data?.site as any)?.url || "";
    const siteHostname = siteUrl ? new URL(siteUrl).hostname : "";

    // Try to collect all available routes
    const availableRoutes = new Set<string>();

    // 1. First try to get routes from Astro's build data
    const routes = (file.data?.astro as any)?.routes || [];
    for (const route of routes) {
      if (route.route) {
        availableRoutes.add(normalizePath(route.route));
      }
    }

    // 2. If routes are not available from Astro, try loading from routes file
    if (availableRoutes.size === 0) {
      const routesFromFile = loadRoutesFromFile(opts.routesFile || defaultOptions.routesFile!);
      routesFromFile.forEach((route) => availableRoutes.add(route));
    }

    // 3. If still no routes found, try to scan the build directory directly
    if (availableRoutes.size === 0) {
      console.log(`${colors.yellow}[WARNING]${colors.reset} No routes found. Consider running generateRoutesFile() before building.`);
      const scannedRoutes = scanDirectoryForRoutes(opts.publicDir || defaultOptions.publicDir!, "", new Set(), opts);
      scannedRoutes.forEach((route) => availableRoutes.add(route));
    }

    visit(tree, "element", (node: Element) => {
      if (!isElement(node, "a") || !node.properties)
        return;

      const href = node.properties.href as string;
      if (!href)
        return;

      try {
        // Check if the link is external
        const isExternal = href.startsWith("http") || href.startsWith("//");
        if (isExternal) {
          // External link logic
          if (opts.customExternalLinkTransform) {
            opts.customExternalLinkTransform(node);
            return;
          }

          // Process the node with external link styling
          processLinkNode(node, "external", opts.externalLinkClass, opts);

          // Add target and rel attributes for external links
          node.properties.target = opts.target;
          node.properties.rel = opts.rel;

          // Add external link icon if not using custom wrapper
          if (opts.content && !opts.wrapperTemplate) {
            const contentNode: Element = {
              type: "element",
              tagName: "span",
              properties: { className: opts.contentClass ? [opts.contentClass] : [] },
              children: [{
                type: "text",
                value: opts.content.value,
              }],
            };

            node.children.push(contentNode);
          }
        }
        else {
          // Internal link logic
          let path = href;

          // Handle relative paths
          if (path.startsWith("/")) {
            path = path.substring(1);
          }

          // Normalize the path for comparison
          const normalizedPath = normalizePath(path);

          // Check if path exists in our routes
          const pathExists = availableRoutes.has(normalizedPath)
            || availableRoutes.has(`${normalizedPath}/index`)
            || (path === "/" || path === "");

          if (pathExists) {
            // Internal link to existing path
            if (opts.customInternalLinkTransform) {
              opts.customInternalLinkTransform(node);
              return;
            }

            // Process the node with internal link styling
            processLinkNode(node, "internal", opts.internalLinkClass, opts);
          }
          else {
            // Try to check file existence as fallback (only if we have very few routes)
            let fileExists = false;

            if (availableRoutes.size < 5) {
              const publicDirPath = opts.publicDir || defaultOptions.publicDir!;

              try {
                const publicPath = join(publicDirPath, path);
                fileExists = existsSync(publicPath)
                  || existsSync(`${publicPath}.html`)
                  || existsSync(join(publicPath, "index.html"));
              }
              catch (error) {
                // Ignore errors and continue
              }
            }

            if (fileExists) {
              // Internal link to existing file
              if (opts.customInternalLinkTransform) {
                opts.customInternalLinkTransform(node);
                return;
              }

              // Process the node with internal link styling
              processLinkNode(node, "internal", opts.internalLinkClass, opts);
            }
            else {
              // Broken internal link
              if (opts.customBrokenLinkTransform) {
                opts.customBrokenLinkTransform(node);
                return;
              }

              // Process the node with broken link styling
              processLinkNode(node, "broken", opts.brokenLinkClass, opts);
            }
          }
        }
      }
      catch (error) {
        console.error(`${colors.red}[ERROR]${colors.reset} Error in rehype-smart-links: ${colors.bold}${error instanceof Error ? error.message : String(error)}${colors.reset}`);
      }
    });
  };
}
