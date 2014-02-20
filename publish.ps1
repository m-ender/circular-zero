# Make sure everything you want to publish has been committed to master
# and there are no uncommitted changes. Otherwise, this script may do
# horrible things.

git checkout gh-pages
git merge master
git checkout master
