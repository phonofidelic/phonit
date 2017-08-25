#!/usr/bin/env node

/*
	Based on a tutorial by Lukas White: https://www.sitepoint.com/javascript-command-line-interface-cli-node-js/
*/

'use-strict';

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

// find fonts at http://www.figlet.org/
const fonts = ['cyberlarge', 'colossal', 'isometric3', 'block'];

const github = new GitHubApi({
	version:'3.0.0'
});

function getGithubCredentials(callback) {
	var questions = [
		{
			name: 'username',
			type: 'input',
			message: 'Enter your Github username or email address:',
			validate: function(value) {
				if (value.length) {
					return true;
				} else {
					return 'Please enter youy username or email address.'
				}
			}
		},
		{
			name: 'password',
			type: 'password',
			message: 'Enter your password:',
			validate: function(value) {
				if (value.length) {
					return true;
				} else {
					return 'Please enter your password.';
				}
			}
		}
	];

	inquirer.prompt(questions).then(callback);
}

function getGithubToken(callback) {
	const prefs = new Preferences('phonit');

	if (prefs.github && prefs.github.token) {
		return callback(null, prefs.github.token);
	}

	// Fetch token
	getGithubCredentials(function(credentials) {
		const status = new Spinner('Authenticating you, please wait...');
		status.start();

		github.authenticate(
			_.extend(
				{
					type: 'basic',
				},
				credentials
			)
		);

		github.authorization.create({
				scopes: ['user', 'public_repo', 'repo', 'repo:status'],
				note: 'phonit, a command-line tool for initializing Git repos'
			}, 
			function(err, res) {
				status.stop();
				if (err) {
					return callback(err);
				}

				if (res.data.token) {
					prefs.github = {
						token: res.data.token
					};
					return callback(null, res.data.token);
				}

				return callback();
			}
		);
	});
}

function createRepo(callback) {
	const argv = require('minimist')(process.argv.slice(2));

	const questions = [
		{
			type: 'input',
			name: 'name',
			message: 'Enter a name for the repository:',
			default: argv._[0] || files.getCurrentDirectoryBase(),
			validate: function(value) {
				if (value.length) {
					return true
				} else {
					return 'Please enter a name for the repo.'
				}
			}
		},
		{
			type: 'input',
			name: 'description',
			default: argv._[1] || null,
			message: 'Optional - enter a descrition of the repo:'
		},
		{
			type: 'list',
			name: 'visibility',
			message: 'Public or private?',
			choices: ['public', 'private'],
			default: 'public'
		}
	];

	inquirer.prompt(questions).then(function(answers) {
		const status = new Spinner('Creating repository...');
		status.start();

		const data = {
			name: answers.name,
			description: answers.description,
			private: (answers.visibility === 'private')
		};

		github.repos.create(
			data,
			function(err, res) {
				status.stop();
				if (err) {
					return callback(err)
				}

				return callback(null, res.data.clone_url);
			}
		);
	});
}

function createGitignore(callback) {
	const filelist = _.without(fs.readdirSync('.'), '.git', '.gitignore');

	if (filelist.length) {
		inquirer.prompt(
			{
				type: 'checkbox',
				name: 'ignore',
				message: 'Select the files and/or folders you wish to ignore:',
				choices: filelist,
				default: ['node_modules', 'bower_components', '.DS_Store']
			}
		).then(function(answers) {
			if (answers.ignore.length) {
				fs.writeFileSync('.gitignore', answers.ignore.join('\n'));
			} else {
				touch('.gitignore');
			}
			return callback();
		});
	} else {
		touch('.gitignore');
		return callback();
	}
}

function setupRepo(url, callback) {
	const status = new Spinner('Setting up the repository...');
	status.start();

	git.init()
		 .add('.gitignore')
		 .add('./*')
		 .commit('Initial commit')
		 .addRemote('origin', url)
		 .push('origin', 'master')
		 .exec(function() {
		 	status.stop();
		 	return callback();
		 });
}

function githubAuth(callback) {
	getGithubToken(function(err, token) {
		if (err) {
			return callback(err);
		}

		github.authenticate({
			type: 'oauth',
			token: token
		});

		return callback(null, token);
	});
}

clear();

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

if (files.directoryExists('.git')) {
	log(chalk.red('Git repo already exists!'));
	process.exit();
}

// Run main logic
githubAuth(function(err, authed) {
	if (err) {
		switch (err.code) {
			case 401:
				log(chalk.red('Could not log you in. Please try again.', err));
				break;

			case 422:
				log(chalk.red('You already have an access token.', err));
				break
		}
	}

	if (authed) {
		log(chalk.green('Authentication successful!'));
		createRepo(function(err, url) {
			if (err) {
				log(chalk.red('An error occured (1):', err.message));
				return;
			}

			if (url) {
				createGitignore(function() {
					setupRepo(url, function(err) {
						if (err) {
							log(chalk.red('An error occured (2):', err));
							return;
						}

						log(chalk.green('All done!'));
					})
				})
			} else {
				log(chalk.red('No valid url'));
			}
		})
	}
})

