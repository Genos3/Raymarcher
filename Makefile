# CC = gcc
CC = C:\games\msys64\mingw64\bin\gcc

SRC_DIR = source

CFLAGS = -O2 -std=c23 -Wall -Wno-maybe-uninitialized -fms-extensions -lto -I$(SRC_DIR)
LDFLAGS = -lSDL2 -lSDL2_ttf -lopengl32 -lgdi32 -luser32 -lwinmm -flto

BUILD = build
SRCS = $(SRC_DIR)

FILES_CC = $(foreach dir, $(SRCS), $(wildcard $(dir)/*.c))

OBJS = $(addprefix $(BUILD)/, $(notdir $(FILES_CC:%.c=%.o)))

TARGET = raymarch

.PHONY: all clean

all: $(TARGET)

VPATH = $(SRCS)

$(TARGET): $(OBJS)
	@echo linking
	@$(CC) $^ $(LDFLAGS) -o $@
	@echo built $(TARGET)

$(BUILD)/%.o: %.c | $(BUILD)
	@echo $<
	@$(CC) $(CFLAGS) -c $< -o $@

$(BUILD):
	@mkdir -p $@

clean:
	rm -rf $(BUILD)/* $(TARGET)
