"use client"

import React, { Fragment, useMemo, useState } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

export interface ContributionData {
  date: string
  count: number
  level: number
}

export interface ContributionGraphProps {
  data?: ContributionData[]
  year?: number
  className?: string
  showLegend?: boolean
  showTooltips?: boolean
  colors?: string[]
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const COLUMN_COUNT = 53
const LABEL_COLUMN_WIDTH = 48

const DEFAULT_CONTRIBUTION_COLORS = [
  "#ebedf0",
  "#9be9a8",
  "#40c463",
  "#30a14e",
  "#216e39",
]

const CONTRIBUTION_LEVELS = [0, 1, 2, 3, 4]

export function ContributionGraph({
  data = [],
  year = new Date().getFullYear(),
  className = "",
  showLegend = true,
  showTooltips = true,
  colors = DEFAULT_CONTRIBUTION_COLORS,
}: ContributionGraphProps) {
  const [hoveredDay, setHoveredDay] = useState<ContributionData | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const palette = useMemo(() => {
    if (!colors.length) {
      return DEFAULT_CONTRIBUTION_COLORS
    }

    if (colors.length >= DEFAULT_CONTRIBUTION_COLORS.length) {
      return colors.slice(0, DEFAULT_CONTRIBUTION_COLORS.length)
    }

    const extended = [...colors]
    for (let i = colors.length; i < DEFAULT_CONTRIBUTION_COLORS.length; i++) {
      extended.push(DEFAULT_CONTRIBUTION_COLORS[i])
    }
    return extended
  }, [colors])

  // Generate all days for the year
  const yearData = useMemo(() => {
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)
    const days: ContributionData[] = []

    // Start from the Sunday of the first week that contains January 1st
    // This ensures December gets proper weeks before January
    const firstSunday = new Date(startDate)
    firstSunday.setDate(startDate.getDate() - startDate.getDay())

    // Generate 53 weeks (GitHub shows 53 weeks)
    for (let week = 0; week < 53; week++) {
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(firstSunday)
        currentDate.setDate(firstSunday.getDate() + week * 7 + day)

        // Include days from the previous year's December if they're in the first week
        const isInRange = currentDate >= startDate && currentDate <= endDate
        const isPreviousYearDecember =
          currentDate.getFullYear() === year - 1 &&
          currentDate.getMonth() === 11
        const isNextYearJanuary =
          currentDate.getFullYear() === year + 1 && currentDate.getMonth() === 0

        if (isInRange || isPreviousYearDecember || isNextYearJanuary) {
          const dateString = currentDate.toISOString().split("T")[0]
          const existingData = data.find((d) => d.date === dateString)

          days.push({
            date: dateString,
            count: existingData?.count || 0,
            level: existingData?.level || 0,
          })
        } else {
          // Add empty day for alignment
          days.push({
            date: "",
            count: 0,
            level: 0,
          })
        }
      }
    }

    return days
  }, [data, year])

  // Calculate month headers with colspan
  const monthHeaders = useMemo(() => {
    const headers: { month: string; colspan: number; startWeek: number }[] = []
    const startDate = new Date(year, 0, 1)
    const firstSunday = new Date(startDate)
    firstSunday.setDate(startDate.getDate() - startDate.getDay())

    let currentMonth = -1
    let currentYear = -1
    let monthStartWeek = 0
    let weekCount = 0

    for (let week = 0; week < 53; week++) {
      const weekDate = new Date(firstSunday)
      weekDate.setDate(firstSunday.getDate() + week * 7)

      // Use a combined key for month and year to handle December from previous year
      const monthKey = weekDate.getMonth()
      const yearKey = weekDate.getFullYear()

      if (monthKey !== currentMonth || yearKey !== currentYear) {
        if (currentMonth !== -1) {
          // Only show months from the current year, and only show December from previous year
          // if it actually contains days from the current year and has enough weeks to justify a header
          const shouldShowMonth =
            currentYear === year ||
            (currentYear === year - 1 &&
              currentMonth === 11 &&
              startDate.getDay() !== 0 &&
              weekCount >= 2)

          if (shouldShowMonth) {
            headers.push({
              month: MONTHS[currentMonth],
              colspan: weekCount,
              startWeek: monthStartWeek,
            })
          }
        }
        currentMonth = monthKey
        currentYear = yearKey
        monthStartWeek = week
        weekCount = 1
      } else {
        weekCount++
      }
    }

    // Add the last month
    if (currentMonth !== -1) {
      const shouldShowMonth =
        currentYear === year ||
        (currentYear === year - 1 &&
          currentMonth === 11 &&
          startDate.getDay() !== 0 &&
          weekCount >= 2)

      if (shouldShowMonth) {
        headers.push({
          month: MONTHS[currentMonth],
          colspan: weekCount,
          startWeek: monthStartWeek,
        })
      }
    }

    return headers
  }, [year])

  const handleDayHover = (day: ContributionData, event: React.MouseEvent) => {
    if (showTooltips && day.date) {
      setHoveredDay(day)
      setTooltipPosition({ x: event.clientX, y: event.clientY })
    }
  }

  const handleDayLeave = () => {
    setHoveredDay(null)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getContributionText = (count: number) => {
    if (count === 0) return "No contributions"
    if (count === 1) return "1 contribution"
    return `${count} contributions`
  }

  return (
    <div className={cn("contribution-graph w-full", className)}>
      <div className="space-y-3 text-xs">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `minmax(${LABEL_COLUMN_WIDTH}px, ${LABEL_COLUMN_WIDTH}px) repeat(${COLUMN_COUNT}, minmax(0, 1fr))` }}
        >
          <span className="sr-only">Months</span>
          {monthHeaders.map((header, index) => (
            <span
              key={`${header.month}-${index}`}
              className="text-left text-foreground"
              style={{ gridColumn: `span ${header.colspan}` }}
            >
              {header.month}
            </span>
          ))}
        </div>

        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `minmax(${LABEL_COLUMN_WIDTH}px, ${LABEL_COLUMN_WIDTH}px) repeat(${COLUMN_COUNT}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: 7 }, (_, dayIndex) => (
            <Fragment key={`row-${dayIndex}`}>
              <div className="flex items-center text-xs text-muted-foreground">
                {dayIndex % 2 === 0 ? DAYS[dayIndex] : ""}
              </div>
              {Array.from({ length: COLUMN_COUNT }, (_, weekIndex) => {
                const dayData = yearData[weekIndex * 7 + dayIndex]

                if (!dayData || !dayData.date) {
                  return <div key={`empty-${dayIndex}-${weekIndex}`} className="aspect-square w-full" />
                }

                const title = showTooltips
                  ? `${formatDate(dayData.date)}: ${getContributionText(dayData.count)}`
                  : undefined

                return (
                  <div
                    key={dayData.date}
                    className="relative aspect-square w-full cursor-pointer"
                    onMouseEnter={(e) => handleDayHover(dayData, e)}
                    onMouseLeave={handleDayLeave}
                    title={title}
                  >
                    <div
                      className="absolute inset-0 rounded-sm transition hover:ring-2 hover:ring-background"
                      style={{
                        backgroundColor:
                          palette[Math.min(dayData.level, palette.length - 1)] ??
                          DEFAULT_CONTRIBUTION_COLORS[0],
                      }}
                    />
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {showTooltips && hoveredDay && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 40,
          }}
        >
          <div className="font-semibold">
            {getContributionText(hoveredDay.count)}
          </div>
          <div className="text-foreground/70">
            {formatDate(hoveredDay.date)}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="text-foreground/70 mt-4 flex items-center justify-between text-xs">
          <span>Less</span>
          <div className="flex items-center gap-1">
            {CONTRIBUTION_LEVELS.map((level) => (
              <div
                key={level}
                className="h-3 w-3 rounded-sm"
                style={{
                  backgroundColor:
                    palette[Math.min(level, palette.length - 1)] ??
                    DEFAULT_CONTRIBUTION_COLORS[0],
                }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      )}
    </div>
  )
}

export default ContributionGraph
