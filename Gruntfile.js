/* global module */
module.exports = function(grunt) {
  // require('time-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    manifest: grunt.file.readJSON('src/manifest.json'),
    config: {
      tempDir:
        grunt.cli.tasks[0] === 'tgut' ? 'dist/tgut/' : 'dist/tms/',
      buildName:
        grunt.cli.tasks[0] === 'tgut' ? 'tgut-<%= manifest.version %>' : 'tms-<%= manifest.version %>',
    },
    copy: {
      main: {
        expand: true,
        src: ['src/**', '!src/tests.html', '!src/js/tests/**', '!src/img/*.xcf'],
        dest: '<%= config.tempDir %>',
      },
    },
    'string-replace': {
      debugoff: {
        files: {
          '<%= config.tempDir %>src/js/':
            '<%= config.tempDir %>src/js/gsUtils.js',
        },
        options: {
          replacements: [
            {
              pattern: /debugInfo\s*=\s*true/,
              replacement: 'debugInfo = false',
            },
            {
              pattern: /debugError\s*=\s*true/,
              replacement: 'debugError = false',
            },
          ],
        },
      },
      debugon: {
        files: {
          '<%= config.tempDir %>src/js/':
            '<%= config.tempDir %>src/js/gsUtils.js',
        },
        options: {
          replacements: [
            {
              pattern: /debugInfo\s*=\s*false/,
              replacement: 'debugInfo = true',
            },
            {
              pattern: /debugError\s*=\s*false/,
              replacement: 'debugError = true',
            },
          ],
        },
      },
      localesTgut: {
        files: {
          '<%= config.tempDir %>src/_locales/':
            '<%= config.tempDir %>src/_locales/**',
        },
        options: {
          replacements: [
            {
              pattern: /The Marvellous Suspender/gi,
              replacement: 'The Marvellous Tester',
            },
          ],
        },
      },
    },
    crx: {
      public: {
        src: [
          '<%= config.tempDir %>src/**/*',
          '!**/html2canvas.js',
          '!**/Thumbs.db',
        ],
        dest: 'build/zip/<%= config.buildName %>.zip',
      },
      private: {
        src: [
          '<%= config.tempDir %>src/**/*',
          '!**/html2canvas.js',
          '!**/Thumbs.db',
        ],
        dest: 'build/crx/<%= config.buildName %>.crx',
        options: {
          privateKey: 'key.pem',
        },
      },
    },
    clean: ['<%= config.tempDir %>'],
    watch: {
      // Re-copy and re-apply debug strings on any src change
      src: {
        files: ['src/**/*', '!src/**/*.xcf'],
        tasks: ['copy', 'string-replace:debugon'],
        options: { spawn: false },
      },
    },
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-string-replace');
  grunt.loadNpmTasks('grunt-crx');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('default', [
    'clean',
    'copy',
    'string-replace:debugoff',
  ]);
  grunt.registerTask('tgut', [
    'clean',
    'copy',
    'string-replace:debugon',
    'string-replace:localesTgut',
  ]);
  // Dev watch mode: copy to temp dir with debug on, then watch for changes
  grunt.registerTask('dev', [
    'copy',
    'string-replace:debugon',
    'watch',
  ]);
};
