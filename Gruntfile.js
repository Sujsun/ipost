
function getPluginBanner () {
  var pluginBanner = '';
  pluginBanner += '/**\n';
  pluginBanner += ' * Plugin: ipost\n';
  pluginBanner += ' * Author: Sundarasan Natarajan\n';
  pluginBanner += ' * GIT: https://github.com/Sujsun/ipost.git\n';
  pluginBanner += ' * Version: 0.0.1\n';
  pluginBanner += ' */\n';
  return pluginBanner;  
}

var pluginBanner = getPluginBanner();

module.exports = function(grunt) {
  grunt.initConfig({

    watchify: {
      options: {
        debug: true,
        banner: pluginBanner
      },
      dist: {
        src: ['./index.js'],
        dest: 'dist/ipost.js'
      },
    },

    uglify: {
      dist: {
        options: {
          banner: pluginBanner
        },
        files: {
          'dist/ipost.min.js': ['dist/ipost.js']
        }
      }
    },

    watch: {
      dist: {
        files: ['index.js'],
        tasks: ['default']
      },
    },

  });

  grunt.loadNpmTasks('grunt-watchify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('start', 'My start task description', function() {
    grunt.util.spawn({
      cmd: 'npm',
      args: ['start']
    });
    console.log('Server running at http://127.0.0.1:8989 (http://localhost:8989)');
    grunt.task.run('watch');
  });

  grunt.registerTask('default', [
    'watchify',
    'uglify',
    'start',
  ]);
};