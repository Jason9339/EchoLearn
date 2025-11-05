# Git LFS (Large File Storage) Guide

This guide provides instructions on how to use Git LFS to manage large files in this repository.

## What is Git LFS?

Git LFS (Large File Storage) is a Git extension that replaces large files such as audio samples, videos, datasets, and graphics with text pointers inside Git, while storing the file contents on a remote server like GitHub.com or GitHub Enterprise.

This is necessary because Git is not designed to handle large files, and doing so can make the repository slow and bloated. GitHub has a strict file size limit of 100MB, and Git LFS is the recommended way to handle files larger than that.

## Installation

Before you can use Git LFS, you need to install it on your local machine.

### macOS

Using [Homebrew](https://brew.sh/):

```bash
brew install git-lfs
```

### Windows

Using [Chocolatey](https://chocolatey.org/):

```bash
choco install git-lfs
```

Or you can download and run the installer from the [Git LFS website](https://git-lfs.github.com/).

### Linux

Using your distribution's package manager:

```bash
# Debian/Ubuntu
sudo apt-get install git-lfs

# Fedora
sudo dnf install git-lfs
```

After installing, you need to run `git lfs install` once per user account:

```bash
git lfs install
```

## Usage

### Tracking New Large Files

To tell Git LFS to track a new large file, use the `git lfs track` command. For example, to track all `.pth` files:

```bash
git lfs track "*.pth"
```

This will create or update the `.gitattributes` file in your repository. **You must commit the `.gitattributes` file to your repository.**

After that, you can add, commit, and push the large files as you normally would with Git:

```bash
git add my-large-file.pth
git commit -m "Add large file"
git push
```

### Cloning a Repository with LFS Files

When you clone a repository that uses Git LFS, the large files are not downloaded automatically. You need to run `git lfs pull` to download them:

```bash
git clone https://github.com/your/repo.git
cd repo
git lfs pull
```

### Pulling Changes

When you pull changes from the remote repository, Git will download the LFS pointers, but not the large files themselves. You need to run `git lfs pull` to download the updated large files:

```bash
git pull
git lfs pull
```

## Best Practices

*   **Track file types, not individual files:** It's usually better to track file types (e.g., `*.pth`, `*.wav`) rather than individual files. This way, you don't have to remember to track each new large file you add.
*   **Commit `.gitattributes`:** Always commit the `.gitattributes` file to your repository. This file tells Git which files to track with LFS.
*   **Use `git lfs ls-files`:** To see a list of all the files that are being tracked by Git LFS, run `git lfs ls-files`.
*   **Avoid committing large files directly to Git:** If you accidentally commit a large file to Git without tracking it with LFS, you'll need to rewrite the history of your repository to remove it. This can be a complex and destructive process, so it's best to avoid it in the first place.
