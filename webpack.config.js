const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const packagejson = require('./package.json');

const dashLibraryName = packagejson.name.replace(/-/g, '_');

module.exports = function (env, argv) {
    const mode = (argv && argv.mode) || 'production';
    const entry = [path.join(__dirname, 'src/ts/index.ts')];
    const output = {
        path: path.join(__dirname, dashLibraryName),
        filename: `${dashLibraryName}.js`,
        library: dashLibraryName,
        libraryTarget: 'umd',
    }

    const externals = {
        react: {
            commonjs: 'react',
            commonjs2: 'react',
            amd: 'react',
            umd: 'react',
            root: 'React',
        },
        'react-dom': {
            commonjs: 'react-dom',
            commonjs2: 'react-dom',
            amd: 'react-dom',
            umd: 'react-dom',
            root: 'ReactDOM',
        },
    };

    return {
        output,
        mode,
        entry,
        target: 'web',
        externals,
        // Optimization for production
        optimization: {
            usedExports: true,
            sideEffects: true,
            minimize: true,
        },
        plugins: [
            new webpack.DefinePlugin({
                'process.env.APP_VERSION': JSON.stringify(packagejson.version),
            }),
            new CopyPlugin({
                patterns: [
                    {
                        from: path.join(__dirname, 'src/icons.json'),
                        to: path.join(__dirname, dashLibraryName, 'icons.json'),
                    },
                ],
            }),
        ],
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
            alias: {
                '@hooks': path.resolve(__dirname, 'src/ts/hooks/'),
                '@components': path.resolve(__dirname, 'src/ts/components/'),
                '@utils': path.resolve(__dirname, 'src/ts/utils/'),
                '@types': path.resolve(__dirname, 'src/ts/types/'),
                '@context': path.resolve(__dirname, 'src/ts/context/'),
                '@constants': path.resolve(__dirname, 'src/ts/constants/'),
                '@store': path.resolve(__dirname, 'src/ts/store/'),
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    use: [
                        {
                            loader: 'style-loader',
                            options: {
                                insert: function insertAtTop(element) {
                                    var parent = document.querySelector("head");
                                    var lastInsertedElement =
                                        window._lastElementInsertedByStyleLoader;

                                    if (!lastInsertedElement) {
                                        parent.insertBefore(element, parent.firstChild);
                                    } else if (lastInsertedElement.nextSibling) {
                                        parent.insertBefore(element, lastInsertedElement.nextSibling);
                                    } else {
                                        parent.appendChild(element);
                                    }

                                    window._lastElementInsertedByStyleLoader = element;
                                },
                            },
                        },
                        {
                            loader: 'css-loader',
                            options: {
                                importLoaders: 1,
                            },
                        },
                        {
                            loader: 'postcss-loader',
                        },
                    ],
                },
            ]
        }
    }
}
