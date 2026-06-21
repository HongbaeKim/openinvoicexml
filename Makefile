.PHONY: test type lint

test:
	npm test

type:
	npm run typecheck

lint:
	npm run lint