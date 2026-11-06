# DX TimeShift - PC tests for the firmware logic
#
#   make test    build and run all tests (exit code 0 = all passed)
#   make clean   remove the built program
#
# Needs only g++ (C++17) and make. No Arduino software is needed.

CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Werror
INCLUDES  = -I../timeshift
HEADERS   = ../timeshift/timeshift_core.h ../timeshift/timeshift_config.h

test_timeshift: test_timeshift.cpp $(HEADERS)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o $@ test_timeshift.cpp

.PHONY: test clean
test: test_timeshift
	./test_timeshift

clean:
	rm -f test_timeshift
