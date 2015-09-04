import path from "path"
import webpack from "webpack"
import ExtractTextPlugin from "extract-text-webpack-plugin"

import markdownIt from "markdown-it"
import markdownItTocAndAnchor from "markdown-it-toc-and-anchor"
import hljs from "highlight.js"

import pkg from "./package.json"

import routes from "app/routes"
// import * as reducers from "app/ducks"
import * as pageComponents from "app/pageComponents"
// instead of using the collection.json that has been made in during build
// we directly use the module cache responsible of the build, since it's still
// in memory. This avoid us a fs read + handling some potential async issues
// (since the collection.json is made by a plugin _after_ the build)
import collection from "statinamic/lib/json-collection-loader/cache"

import build from "statinamic/lib/build"
import configurator from "statinamic/lib/configurator"
import jsonCollectionPlugin from
  "statinamic/lib/json-collection-loader/plugin"

const config = configurator(pkg)

const root = path.join(__dirname)
const source = path.join(root, "content")
const dest = path.join(root, "dist")

build({
  config,
  source,
  dest,

  exports: {
    routes,
    initialState: {
      pageComponents,
      collection,
    },
  },

  webpack: {
    entry: {
      index: [
        path.join(__dirname, "client"),
      ],
    },

    output: {
      path: dest,
      filename: "[name].js",
      publicPath: "/",
    },

    resolve: {
      extensions: [
        // node default extensions
        ".js",
        ".json",
        // for all other extensions specified directly
        "",
      ],
    },

    module: {
      // ! \\ note that loaders are executed from bottom to top !
      loaders: [
        //
        // statinamic requirement
        //
        {
          test: /\.md$/,
          loaders: [
            `file?name=[path][name]/index.json&context=${ source }`,
            "statinamic/lib/json-collection-loader",
            "statinamic/lib/markdown-as-json-loader",
          ],
        },
        {
          test: /\.json$/,
          loaders: [
            "json",
          ],
        },

        // your loaders
        {
          test: /\.js$/,
          loaders: [
            ...config.__DEV__ && [ "react-hot" ],
            "babel",
            ...config.__DEV__ && [ "eslint" ],
          ],
          exclude: /node_modules/,
        },
      ],
    },

    plugins: [
      //
      // statinamic requirement
      //
      jsonCollectionPlugin({
        filename: "collection.json",
      }),

      // your plugins
      new webpack.DefinePlugin(
        // transform string as "string" so hardcoded replacements are
        // syntaxically correct
        Object.keys(config).reduce((obj, constName) => {
          const value = config[constName]
          return {
            ...obj,
            [constName]: (
              typeof value === "string" ? JSON.stringify(value) : value
            ),
          }
        }, {})
      ),
      new ExtractTextPlugin("[name].css", { disable: !config.__PROD__ }),
      ...config.__PROD__ && [
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin({
          compress: {
            warnings: false,
          },
        }),
      ],
    ],

    node: {
      // https://github.com/webpack/webpack/issues/451
      // run tape test with webpack
      fs: "empty",
    },

    markdownIt: (
      markdownIt({
        html: true,
        linkify: true,
        typographer: true,
        highlight: (code, lang) => {
          code = code.trim()
          // language is recognized by highlight.js
          if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(lang, code).value
          }
          // ...or fallback to auto
          return hljs.highlightAuto(code).value
        },
      })
        .use(markdownItTocAndAnchor, {
          tocFirstLevel: 2,
        })
    ),

    jsonCollection: {
      urlify: (url) => url
        // .replace(/^content\//, "")
        .replace(/^demo\/content\//, "")
        .replace(/\.md$/, "")
      ,
    },
  },
})