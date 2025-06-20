-- Debug AppleScript for Timing Plugin
-- This script tests the Timing integration outside of the plugin

tell application "TimingHelper"
	if not advanced scripting support available then
		error "This script requires a Timing Connect subscription. Please contact support via https://timingapp.com/contact to upgrade."
	end if
end tell

-- Get today's date
set datevar to current date
set startDate to datevar
set hours of startDate to 0
set minutes of startDate to 0
set seconds of startDate to 0

set endDate to datevar
set hours of endDate to 23
set minutes of endDate to 59
set seconds of endDate to 59

tell application "TimingHelper"
	set reportSettings to make report settings
	set exportSettings to make export settings
	
	tell reportSettings
		set first grouping mode to by month
		set second grouping mode to by project
		
		set time entries included to true
		set time entry title included to true
		set also group by time entry title to true
		set time entry timespan included to true
		set time entry notes included to true

		set app usage included to true
		set application info included to true
		set timespan info included to true
		
		set also group by application to true
	end tell
	
	tell exportSettings
		set file format to JSON 
		set duration format to seconds
		set short entries included to true
	end tell
	
	set exportPath to "/Users/nakanotomoya/Desktop/debug_timing_export.json"
	
	save report with report settings reportSettings export settings exportSettings between startDate and endDate to exportPath
	
	-- Clean up settings to avoid memory leaks
	delete reportSettings
	delete exportSettings
	
	return "Report saved to " & exportPath
end tell