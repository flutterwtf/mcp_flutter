all: build_extension

build_extension:
	cd web_app && flutter build web --release
	flutter pub run devtools_extensions build_and_copy --source=web_app --dest=extension/build

validate_extension:
	flutter pub run devtools_extensions validate --package=.

clean:
	rm -rf extension/devtools/build
	cd web_app && flutter clean

run: 
	flutter run -d chrome --dart-define=use_simulated_environment=true
