const chalk = require('chalk'),
			clear = require('clear'),
			CLI = require('clui'),
			figlet = require('figlet'),
			inquirer = require('inquirer'),
			Preferences = require('preferences'),
			Spinner = CLI.Spinner,
			GitHubApi = require('github'),
			_ = require('lodash'),
			git = require('simple-git')(),
			touch = require('touch'),
			fs = require('fs'),
			files = require('./lib/files'),
			log = console.log;

clear();

const fonts = ['cyberlarge', 'colossal', 'isometric3', 'block'];


// Display intro text
log(
	chalk.black(
		figlet.textSync('phonit', { 
			font: fonts[2],
			horizontalLayout: 'full'
		})
	),
	chalk.black('\n\nA command-line tool for initializing Git repos')
);