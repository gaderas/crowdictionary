module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: 'client/src/js/<%= pkg.name %>.js',
                dest: 'client/build/js/<%= pkg.name %>.min.js'
            }
        },
        sass: {
            dist: {
                options: {
                    style: 'expanded'
                },
                files: {
                    'client/build/css/main.css': 'client/src/css/main.scss'
                }
            }
        },
        copy: {
            main: {
                cwd: 'client/src/html/',
                src: '**',
                dest: 'client/build/',
                filter: 'isFile',
                expand: true
            },
            l10n: {
                cwd: 'shared/src/l10n/',
                src: '**',
                dest: 'client/build/l10n/',
                filter: 'isFile',
                expand: true
            },
            assets: {
                cwd: 'shared/src/assets/',
                src: '**',
                dest: 'client/build/assets/',
                expand: true
            }
        },
        jsonlint: {
            l10n: {
                src: ['shared/src/l10n/*.json']
            }
        },
        concat: {
            jquery: {
                files: {
                    'client/build/js/dep/jquery.js': ['bower_components/jquery/dist/jquery.js'],
                    'client/build/js/dep/backbone.js': ['bower_components/backbone/backbone.js'],
                    'client/build/js/dep/underscore.js': ['bower_components/underscore/underscore.js']
                }
            }
        },
        shell: {
            'jsx-shared': {
                command: "node ./node_modules/react-tools/bin/jsx shared/src/jsx shared/build/js"
            },
            'jsx-server': {
                command: "node ./node_modules/react-tools/bin/jsx server/src/jsx server/build/js"
            },
            'jsx-client': {
                command: "node ./node_modules/react-tools/bin/jsx client/src/jsx client/build/js/prebrowserify"
            }
        },
        browserify: {
            './client/build/js/app.js': ['./client/build/js/prebrowserify/app.js']
        },
        clean: [
            './client/build',
            './shared/build',
            './server/build'
        ]
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    // Load Sass plugin.
    grunt.loadNpmTasks('grunt-contrib-sass');
    // Load copy plugin.
    grunt.loadNpmTasks('grunt-contrib-copy');
    // Load bower-install-simple
    grunt.loadNpmTasks("grunt-bower-install-simple");
    // Load concat
    grunt.loadNpmTasks("grunt-contrib-concat");
    // Load shell
    grunt.loadNpmTasks("grunt-shell");
    // Load browserify
    grunt.loadNpmTasks('grunt-browserify');
    // Load clean
    grunt.loadNpmTasks('grunt-contrib-clean');
    // Load jsonlint
    grunt.loadNpmTasks('grunt-jsonlint');

    grunt.registerTask('bower', ['bower-install-simple', 'concat']);
    grunt.registerTask('jsx', ['shell:jsx-shared', 'shell:jsx-server', 'shell:jsx-client']);
    // Default task(s).
    grunt.registerTask('default', ['jsonlint', 'uglify', 'sass', 'copy', 'bower', 'jsx', 'browserify']);
};

/* vim: expandtab:tabstop=4:softtabstop=4:shiftwidth=4:set filetype=javascript: */
