import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import useSupabaseStorage from '../../supabase/useSupabaseStorage';
import { supabase, deleteName } from '../../supabase/supabaseClient';
import { Chart as ChartJS, 
  LineController, LineElement, PointElement, 
  LinearScale, CategoryScale, Title, BarController, 
  BarElement, PieController, ArcElement, 
  RadarController, RadialLinearScale 
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
// import CalendarButton from '../depreciated/CalendarButton/CalendarButton';
import styles from './Profile.module.css';
import { formatTimestamp } from '../../utils/adminActions';
import PropTypes from 'prop-types';

// Register Chart.js components
ChartJS.register(
  LineController, LineElement, BarController, BarElement,
  PieController, ArcElement, PointElement, LinearScale,
  CategoryScale, Title, RadarController, RadialLinearScale
);

// Constants and Configurations
const SORT_CONFIG = {
  individual: [
    { key: 'rating', label: 'Rating' },
    { key: 'name', label: 'Name' },
    { key: 'wins', label: 'Wins' },
    { key: 'losses', label: 'Losses' },
    { key: 'updated_at', label: 'Last Updated' }
  ],
  aggregated: [
    { key: 'avgRating', label: 'Average Rating' },
    { key: 'totalRatings', label: 'Times Rated' },
    { key: 'name', label: 'Name' },
    { key: 'totalWins', label: 'Total Wins' },
    { key: 'totalLosses', label: 'Total Losses' }
  ]
};

const TIME_FILTERS = ['All Time', 'Today', 'This Week', 'This Month'];
export const DEFAULT_RATING = 1500;
const ACTIVE_THRESHOLD = 3600000; // 1 hour in milliseconds

// Add new constants for filtering
const FILTER_OPTIONS = {
  STATUS: {
    ALL: 'all',
    ACTIVE: 'active',
    HIDDEN: 'hidden'
  },
  SORT: {
    RATING: 'rating',
    WORST_RATING: 'worst_rating',
    NAME: 'name',
    LAST_UPDATED: 'updated_at',
    MATCHES: 'matches'
  }
};

// Reusable Components
const Button = memo(({ onClick, className, disabled, children, variant = 'default', ...props }) => (
  <button
    onClick={onClick}
    className={`${styles.button} ${styles[variant]} ${className || ''}`}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
));

const Modal = memo(({ title, isOpen, onClose, children }) => {
  if (!isOpen) {
    return null;
  }
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
});

const Card = memo(({ className, children, ...props }) => (
  <div className={`${styles.card} ${className || ''}`} {...props}>
    {children}
  </div>
));

const StatsCard = memo(({ label, value, emoji }) => (
  <Card className={styles.statItem}>
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue}>{value}</span>
    {emoji && <span className={styles.statEmoji}>{emoji}</span>}
  </Card>
));

// Utility Functions
const calculateStats = (ratings, filterStatus = FILTER_OPTIONS.STATUS.ALL) => {
  const filteredRatings = ratings.filter(r => {
    if (filterStatus === FILTER_OPTIONS.STATUS.ACTIVE) {
      return !r.isHidden;
    }
    if (filterStatus === FILTER_OPTIONS.STATUS.HIDDEN) {
      return r.isHidden;
    }
    return true;
  });

  const totalNames = filteredRatings.length;
  const totalMatches = filteredRatings.reduce((sum, r) => sum + (r.wins || 0) + (r.losses || 0), 0);
  const averageRating = totalNames > 0 
    ? Math.round(filteredRatings.reduce((sum, r) => sum + (r.rating || DEFAULT_RATING), 0) / totalNames) 
    : 0;
  
  return {
    totalNames,
    averageRating,
    totalMatches,
    winRate: totalMatches > 0 
      ? Math.round((filteredRatings.reduce((sum, r) => sum + (r.wins || 0), 0) / totalMatches) * 100)
      : 0,
    activeNames: ratings.filter(r => !r.isHidden).length,
    hiddenNames: ratings.filter(r => r.isHidden).length
  };
};

const processUserRatings = (data) => {
  const lastActivity = {};
  const ratingsByUser = {};

  if (!data) {
    return { lastActivity, ratingsByUser };
  }

  data.forEach(item => {
    if (!item.name_options) {
      return;
    }
    
    const userName = item.user_name;
    
    // Update last activity
    if (!lastActivity[userName] || new Date(item.updated_at) > new Date(lastActivity[userName])) {
      lastActivity[userName] = item.updated_at;
    }
    
    // Process ratings
    if (!ratingsByUser[userName]) {
      ratingsByUser[userName] = [];
    }
    
    ratingsByUser[userName].push({
      id: item.name_options.id,
      name: item.name_options.name,
      description: item.name_options.description,
      rating: parseInt(item.rating || DEFAULT_RATING, 10),
      wins: parseInt(item.wins || 0, 10),
      losses: parseInt(item.losses || 0, 10),
      updated_at: item.updated_at || new Date().toISOString()
    });
  });

  return { lastActivity, ratingsByUser };
};

// Subcomponents
const ProfileStats = memo(({ ratings, filterStatus }) => {
  const stats = useMemo(() => calculateStats(ratings, filterStatus), [ratings, filterStatus]);

  return (
    <div className={styles.statsContainer}>
      <StatsCard 
        label={filterStatus === FILTER_OPTIONS.STATUS.ALL ? "Total Names" : "Filtered Names"} 
        value={stats.totalNames} 
        emoji="📝" 
      />
      <StatsCard label="Average Rating" value={stats.averageRating} emoji="⭐" />
      <StatsCard label="Total Matches" value={stats.totalMatches} emoji="🎮" />
      <StatsCard label="Win Rate" value={`${stats.winRate}%`} emoji="🏆" />
      {filterStatus === FILTER_OPTIONS.STATUS.ALL && (
        <>
          <StatsCard label="Active Names" value={stats.activeNames} emoji="✅" />
          <StatsCard label="Hidden Names" value={stats.hiddenNames} emoji="🔒" />
        </>
      )}
    </div>
  );
});

const NameCard = memo(({ 
  name, 
  isHidden, 
  onToggleVisibility, 
  onDelete, 
  isAdmin, 
  isAggregated = false 
}) => {
  const {
    id,
    name: nameText,
    rating = DEFAULT_RATING,
    wins = 0,
    losses = 0,
    averageRating,
    totalVotes,
    userCount,
    updated_at
  } = name;

  const displayRating = isAggregated ? averageRating : rating;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <Card className={`${styles.nameCard} ${isHidden ? styles.isHidden : ''}`}>
      <div className={styles.nameHeader}>
        <h3 className={styles.nameTitle}>{nameText}</h3>
        <div className={styles.rating}>
          {displayRating.toLocaleString()}
          {isAggregated && <span className={styles.ratingLabel}> avg</span>}
        </div>
      </div>
      
      <div className={styles.stats}>
        <div className={styles.record}>
          <span className={styles.wins}>{wins} wins</span>
          <span className={styles.separator}>•</span>
          <span className={styles.losses}>{losses} losses</span>
          {totalMatches > 0 && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.winRate}>{winRate}% win rate</span>
            </>
          )}
        </div>
        
        <div className={styles.additionalStats}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Total Matches:</span>
            <span className={styles.statValue}>{totalMatches}</span>
          </div>
          {isAggregated ? (
            <>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Times Rated:</span>
                <span className={styles.statValue}>{totalVotes}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Users:</span>
                <span className={styles.statValue}>{userCount}</span>
              </div>
            </>
          ) : (
            updated_at && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Last Updated:</span>
                <span className={styles.statValue}>{formatTimestamp(updated_at)}</span>
              </div>
            )
          )}
        </div>
      </div>

      {isAdmin && (
        <div className={styles.cardActions}>
          <button
            onClick={() => onToggleVisibility(id, nameText)}
            className={`${styles.visibilityToggle} ${isHidden ? styles.hidden : ''}`}
            aria-label={`${isHidden ? 'Show' : 'Hide'} ${nameText}`}
          >
            <span className={styles.visibilityIcon}>
              {isHidden ? '🔒' : '🔓'}
            </span>
            <span>{isHidden ? 'Hidden' : 'Hide'}</span>
          </button>
          {isHidden && (
            <button
              onClick={() => onDelete(name)}
              className={`${styles.button} ${styles.delete}`}
              aria-label={`Delete ${nameText}`}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}

      {isHidden && (
        <div className={styles.hiddenStatus}>
          <p className={styles.hiddenText}>This name is hidden from tournaments</p>
        </div>
      )}
    </Card>
  );
});

const UserCard = memo(({ user, onUserAction, isActive }) => (
  <Card 
    className={`${styles.userCard} ${isActive ? styles.active : ''}`}
    onClick={() => onUserAction('view', user)}
  >
    <div className={styles.userInfo}>
      <span className={styles.userName}>{user.name}</span>
      <div className={styles.userStats}>
        <div className={styles.userStat}>
          <span className={styles.userStatLabel}>Names Rated</span>
          <span className={styles.userStatValue}>{user.ratingsCount}</span>
        </div>
        <div className={styles.userStat}>
          <span className={styles.userStatLabel}>Average Rating</span>
          <span className={styles.userStatValue}>{Math.round(user.averageRating)}</span>
        </div>
      </div>
      <span className={styles.lastActive}>{formatTimestamp(user.lastActive)}</span>
    </div>
    {isActive && (
      <div className={styles.userActions}>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onUserAction('export', user);
          }}
        >
          Export
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onUserAction('delete', user);
          }}
          variant="delete"
        >
          Delete
        </Button>
      </div>
    )}
  </Card>
));

const AdminPanel = ({ users, onRefresh }) => {
  const [isMinimized, setIsMinimized] = useState(true);
  const [activeTimeFilter, setActiveTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastActive');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredAndSortedUsers = useMemo(() => {
    // First apply time filter
    let filtered = users;
    if (activeTimeFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (activeTimeFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'thisWeek':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'thisMonth':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }

      filtered = users.filter(user => {
        const lastActiveDate = new Date(user.lastActive);
        return lastActiveDate >= filterDate;
      });
    }

    // Then sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'ratingsCount':
          comparison = b.ratingsCount - a.ratingsCount;
          break;
        case 'averageRating':
          comparison = b.averageRating - a.averageRating;
          break;
        case 'lastActive':
          comparison = new Date(b.lastActive) - new Date(a.lastActive);
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });
  }, [users, activeTimeFilter, sortBy, sortOrder]);

  return (
    <div className={`${styles.adminPanel} ${isMinimized ? styles.minimized : ''}`}>
      <div className={styles.adminHeader}>
        <h2>
          Admin Dashboard
          <span className={styles.sectionSubtitle}>
            {users.length} users registered
          </span>
        </h2>
        <div className={styles.headerControls}>
          <button
            className={`${styles.minimizeButton} ${isMinimized ? styles.minimized : ''}`}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expand dashboard" : "Minimize dashboard"}
          >
            {isMinimized ? "▼" : "▲"}
          </button>
        </div>
      </div>
      
      <div className={styles.adminControls}>
        <div className={styles.controls}>
          {TIME_FILTERS.map(filter => (
            <Button 
              key={filter}
              onClick={() => setActiveTimeFilter(filter.toLowerCase())}
              variant={filter.toLowerCase() === activeTimeFilter ? 'primary' : 'default'}
            >
              {filter}
            </Button>
          ))}
        </div>
        <div className={styles.sortControls}>
          <span className={styles.sortLabel}>Sort by:</span>
          <select 
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="lastActive">Last Active</option>
            <option value="name">Name</option>
            <option value="ratingsCount">Names Rated</option>
            <option value="averageRating">Average Rating</option>
          </select>
          <Button
            onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
            variant="default"
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      <div className={styles.userList}>
        {filteredAndSortedUsers.map(user => (
          <UserCard 
            key={user.id} 
            user={user} 
            onUserAction={onRefresh}
            isActive={user.name === activeTimeFilter}
          />
        ))}
      </div>
    </div>
  );
};

const CHART_METRICS = {
  RATING: {
    key: 'rating',
    label: 'Rating',
    field: 'averageRating',
    color: 'rgba(75, 192, 192, 0.6)',
    borderColor: 'rgba(75, 192, 192, 1)'
  },
  WIN_RATE: {
    key: 'winRate',
    label: 'Win Rate %',
    field: 'winRate',
    color: 'rgba(16, 185, 129, 0.6)',
    borderColor: 'rgb(16, 185, 129)'
  },
  TOTAL_MATCHES: {
    key: 'matches',
    label: 'Total Matches',
    field: 'totalMatches',
    color: 'rgba(99, 102, 241, 0.6)',
    borderColor: 'rgb(99, 102, 241)'
  },
  TIMES_RATED: {
    key: 'timesRated',
    label: 'Times Rated',
    field: 'totalVotes',
    color: 'rgba(244, 114, 182, 0.6)',
    borderColor: 'rgb(244, 114, 182)'
  }
};

const ChartControls = memo(({ onMetricChange, currentMetric }) => (
  <div className={styles.chartControls}>
    <label className={styles.chartLabel}>Metric:</label>
    <select 
      value={currentMetric}
      onChange={(e) => onMetricChange(e.target.value)}
      className={styles.chartSelect}
    >
      {Object.values(CHART_METRICS).map(metric => (
        <option key={metric.key} value={metric.key}>
          {metric.label}
        </option>
      ))}
    </select>
  </div>
));

const ChartSection = memo(({ aggregatedNames, filterStatus }) => {
  const [metric, setMetric] = useState(CHART_METRICS.RATING.key);
  const currentMetric = CHART_METRICS[Object.keys(CHART_METRICS).find(k => 
    CHART_METRICS[k].key === metric
  )];

  const chartData = useMemo(() => {
    const topNames = aggregatedNames.slice(0, 10);

    return {
      labels: topNames.map(n => n.name),
      datasets: [
        {
          label: currentMetric.label,
          data: topNames.map(n => n[currentMetric.field]),
          backgroundColor: topNames.map(n => 
            n.isHidden ? 'rgba(156, 156, 156, 0.6)' : currentMetric.color
          ),
          borderColor: topNames.map(n => 
            n.isHidden ? 'rgba(156, 156, 156, 1)' : currentMetric.borderColor
          ),
          borderWidth: 1,
        }
      ]
    };
  }, [aggregatedNames, currentMetric]);

  // Calculate rating distribution for pie chart
  const ratingDistribution = useMemo(() => {
    const distribution = {
      'Elite (1800+)': 0,
      'Strong (1650-1799)': 0,
      'Good (1500-1649)': 0,
      'Average (1350-1499)': 0,
      'Developing (<1350)': 0
    };

    aggregatedNames.forEach(name => {
      if (name.averageRating >= 1800) {
        distribution['Elite (1800+)']++;
      } else if (name.averageRating >= 1650) {
               distribution['Strong (1650-1799)']++;
             } else if (name.averageRating >= 1500) {
                      distribution['Good (1500-1649)']++;
                    } else if (name.averageRating >= 1350) {
                             distribution['Average (1350-1499)']++;
                           } else {
                             distribution['Developing (<1350)']++;
                           }
    });

    return {
      labels: Object.keys(distribution),
      datasets: [{
        data: Object.values(distribution),
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',   // Elite - Indigo
          'rgba(16, 185, 129, 0.8)',   // Strong - Green
          'rgba(245, 158, 11, 0.8)',   // Good - Amber
          'rgba(59, 130, 246, 0.8)',   // Average - Blue
          'rgba(156, 163, 175, 0.8)',  // Developing - Gray
        ],
        borderColor: [
          'rgb(99, 102, 241)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(59, 130, 246)',
          'rgb(156, 163, 175)',
        ],
        borderWidth: 1
      }]
    };
  }, [aggregatedNames]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Top 10 Cat Names by ${currentMetric.label} - ${
          filterStatus === FILTER_OPTIONS.STATUS.ALL ? 'All' : 
          filterStatus === FILTER_OPTIONS.STATUS.ACTIVE ? 'Active' : 'Hidden'
        } Names`,
        color: 'var(--text-primary)',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      legend: {
        position: 'top',
        labels: {
          color: 'var(--text-primary)'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const name = context.chart.data.labels[context.dataIndex];
            const value = context.raw;
            const nameData = aggregatedNames.find(n => n.name === name);
            const label = `${currentMetric.label}: ${value}${
              currentMetric.key === 'winRate' ? '%' : ''
            }`;
            return `${label}${nameData?.isHidden ? ' (Hidden)' : ''}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'var(--border-color)'
        },
        ticks: {
          color: 'var(--text-secondary)',
          callback: (value) => currentMetric.key === 'winRate' ? `${value}%` : value
        },
        title: {
          display: true,
          text: currentMetric.label,
          color: 'var(--text-primary)'
        }
      },
      x: {
        grid: {
          color: 'var(--border-color)'
        },
        ticks: {
          color: 'var(--text-secondary)',
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  return (
    <div className={styles.chartsContainer}>
      <div className={styles.chartHeader}>
        <ChartControls 
          onMetricChange={setMetric}
          currentMetric={metric}
        />
      </div>
      <div className={styles.chartRow}>
        <div className={styles.chartWrapper}>
          <Bar data={chartData} options={chartOptions} />
        </div>
        <div className={styles.pieChartWrapper}>
          <Pie 
            data={ratingDistribution} 
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                title: {
                  ...chartOptions.plugins.title,
                  text: `Rating Distribution - ${
                    filterStatus === FILTER_OPTIONS.STATUS.ALL ? 'All' : 
                    filterStatus === FILTER_OPTIONS.STATUS.ACTIVE ? 'Active' : 'Hidden'
                  } Names`
                }
              }
            }} 
          />
        </div>
      </div>
    </div>
  );
});

const AggregatedStats = memo(({ 
  allUsersRatings, 
  onToggleVisibility, 
  onDelete,
  isAdmin 
}) => {
  const [filterStatus, setFilterStatus] = useState(FILTER_OPTIONS.STATUS.ACTIVE);
  const [sortBy, setSortBy] = useState(FILTER_OPTIONS.SORT.RATING);
  const [hiddenNames, setHiddenNames] = useState(new Set());

  // Fetch hidden names from database
  useEffect(() => {
    const fetchHiddenNames = async () => {
      try {
        const { data: hiddenData, error: hiddenError } = await supabase
          .from('hidden_names')
          .select('name_id');

        if (hiddenError) {
          throw hiddenError;
        }

        const newHiddenNames = new Set(hiddenData?.map(item => item.name_id) || []);
        setHiddenNames(newHiddenNames);
      } catch (err) {
        console.error('Error fetching hidden names:', err);
      }
    };

    fetchHiddenNames();
  }, []);

  const aggregatedNames = useMemo(() => {
    const nameMap = new Map();

    // Combine ratings for each name across all users
    Object.values(allUsersRatings).forEach(userRatings => {
      userRatings.forEach(rating => {
        if (!rating) {
          return;
        } // Skip if rating is undefined
        
        const isHidden = hiddenNames.has(rating.id);
        
        // Apply filter
        if (filterStatus === FILTER_OPTIONS.STATUS.ACTIVE && isHidden) {
          return;
        }
        if (filterStatus === FILTER_OPTIONS.STATUS.HIDDEN && !isHidden) {
          return;
        }

        if (!nameMap.has(rating.name)) {
          nameMap.set(rating.name, {
            id: rating.id,
            name: rating.name,
            description: rating.description,
            totalRating: 0,
            totalVotes: 0,
            wins: 0,
            losses: 0,
            users: new Set(),
            isHidden,
            updated_at: rating.updated_at || new Date().toISOString()
          });
        }
        
        const nameStats = nameMap.get(rating.name);
        nameStats.totalRating += parseInt(rating.rating || DEFAULT_RATING, 10);
        nameStats.wins += parseInt(rating.wins || 0, 10);
        nameStats.losses += parseInt(rating.losses || 0, 10);
        nameStats.users.add(rating.user_name);
        nameStats.totalVotes++;
        
        // Update the latest updated_at timestamp
        if (!nameStats.updated_at || (rating.updated_at && new Date(rating.updated_at) > new Date(nameStats.updated_at))) {
          nameStats.updated_at = rating.updated_at;
        }
      });
    });

    // Convert to array and calculate averages
    return Array.from(nameMap.values())
      .map(stats => ({
        ...stats,
        averageRating: Math.round(stats.totalRating / stats.totalVotes),
        userCount: stats.users.size,
        winRate: stats.wins + stats.losses > 0 
          ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
          : 0,
        totalMatches: stats.wins + stats.losses
      }))
      .sort((a, b) => {
        switch (sortBy) {
          case FILTER_OPTIONS.SORT.RATING:
            return b.averageRating - a.averageRating;
          case FILTER_OPTIONS.SORT.WORST_RATING:
            return a.averageRating - b.averageRating;
          case FILTER_OPTIONS.SORT.NAME:
            return a.name.localeCompare(b.name);
          case FILTER_OPTIONS.SORT.MATCHES:
            return b.totalMatches - a.totalMatches;
          default:
            return b.averageRating - a.averageRating;
        }
      });
  }, [allUsersRatings, filterStatus, sortBy, hiddenNames]);

  const stats = useMemo(() => {
    const totalNames = aggregatedNames.length;
    const activeNames = aggregatedNames.filter(n => !n.isHidden).length;
    const hiddenNames = aggregatedNames.filter(n => n.isHidden).length;
    const totalMatches = aggregatedNames.reduce((sum, n) => sum + n.totalMatches, 0);
    const averageRating = totalNames > 0 ? Math.round(
      aggregatedNames.reduce((sum, n) => sum + n.averageRating, 0) / totalNames
    ) : 0;
    const winRate = totalMatches > 0 ? Math.round(
      (aggregatedNames.reduce((sum, n) => sum + n.wins, 0) / totalMatches) * 100
    ) : 0;

    return {
      totalNames,
      activeNames,
      hiddenNames,
      totalMatches,
      averageRating,
      winRate
    };
  }, [aggregatedNames]);

  return (
    <section className={styles.aggregatedSection}>
      <header className={styles.aggregatedHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📊</span>
          Overall Cat Name Rankings
          <span className={styles.sectionSubtitle}>
            {stats.activeNames} active, {stats.hiddenNames} hidden
          </span>
        </h2>
        <FilterControls 
          onFilterChange={setFilterStatus}
          onSortChange={setSortBy}
          currentFilter={filterStatus}
          currentSort={sortBy}
        />
      </header>

      <div className={styles.statsContainer}>
        <StatsCard 
          label={filterStatus === FILTER_OPTIONS.STATUS.ALL ? "Total Names" : "Filtered Names"} 
          value={stats.totalNames} 
          emoji="📝" 
        />
        <StatsCard label="Average Rating" value={stats.averageRating} emoji="⭐" />
        <StatsCard label="Total Matches" value={stats.totalMatches} emoji="🎮" />
        <StatsCard label="Win Rate" value={`${stats.winRate}%`} emoji="🏆" />
        {filterStatus === FILTER_OPTIONS.STATUS.ALL && (
          <>
            <StatsCard label="Active Names" value={stats.activeNames} emoji="✅" />
            <StatsCard label="Hidden Names" value={stats.hiddenNames} emoji="🔒" />
          </>
        )}
      </div>
      
      <ChartSection aggregatedNames={aggregatedNames} filterStatus={filterStatus} />

      <div className={styles.ratingsGrid}>
        {aggregatedNames.map(name => (
          <NameCard
            key={name.id}
            name={{
              ...name,
              name: name.name,
              rating: name.averageRating,
              wins: name.wins,
              losses: name.losses,
              averageRating: name.averageRating,
              totalVotes: name.totalVotes,
              userCount: name.userCount
            }}
            isHidden={name.isHidden}
            onToggleVisibility={onToggleVisibility}
            onDelete={onDelete}
            isAdmin={isAdmin}
            isAggregated={true}
          />
        ))}
      </div>
    </section>
  );
});

// New FilterControls component
const FilterControls = memo(({ onFilterChange, onSortChange, currentFilter, currentSort }) => (
  <div className={styles.filterControls}>
    <div className={styles.filterGroup}>
      <label className={styles.filterLabel}>Status:</label>
      <select 
        value={currentFilter} 
        onChange={(e) => onFilterChange(e.target.value)}
        className={styles.filterSelect}
      >
        <option value={FILTER_OPTIONS.STATUS.ALL}>All Names</option>
        <option value={FILTER_OPTIONS.STATUS.ACTIVE}>Active Names</option>
        <option value={FILTER_OPTIONS.STATUS.HIDDEN}>Hidden Names</option>
      </select>
    </div>
    <div className={styles.filterGroup}>
      <label className={styles.filterLabel}>Sort by:</label>
      <select 
        value={currentSort} 
        onChange={(e) => onSortChange(e.target.value)}
        className={styles.filterSelect}
      >
        <option value={FILTER_OPTIONS.SORT.RATING}>Best Rating</option>
        <option value={FILTER_OPTIONS.SORT.WORST_RATING}>Worst Rating</option>
        <option value={FILTER_OPTIONS.SORT.NAME}>Name</option>
        <option value={FILTER_OPTIONS.SORT.MATCHES}>Total Matches</option>
      </select>
    </div>
  </div>
));

// Enhanced chart data preparation
const prepareChartData = (ratings, filterStatus, hiddenNames) => {
  const filteredRatings = ratings.filter(r => {
    const isHidden = hiddenNames.has(r.id);
    if (filterStatus === FILTER_OPTIONS.STATUS.ACTIVE) {
      return !isHidden;
    }
    if (filterStatus === FILTER_OPTIONS.STATUS.HIDDEN) {
      return isHidden;
    }
    return true;
  });

  const sortedRatings = [...filteredRatings].sort((a, b) => b.rating - a.rating);

  return {
    labels: sortedRatings.map(r => r.name),
    datasets: [
      {
        label: 'Rating',
        data: sortedRatings.map(r => r.rating),
        backgroundColor: sortedRatings.map(r => 
          hiddenNames.has(r.id) ? 'rgba(156, 156, 156, 0.6)' : 'rgba(75, 192, 192, 0.6)'
        ),
        borderColor: sortedRatings.map(r => 
          hiddenNames.has(r.id) ? 'rgba(156, 156, 156, 1)' : 'rgba(75, 192, 192, 1)'
        ),
        borderWidth: 1
      }
    ]
  };
};

// Add this new component for showing rating trends
const RatingTrends = memo(({ userName, selectedName = null }) => {
  const [ratingHistory, setRatingHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('month'); // 'week', 'month', 'year', 'all'
  
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        // Import the function
        const { getRatingHistory } = await import('../../supabase/supabaseClient');
        const history = await getRatingHistory(userName, selectedName?.id, 100);
        setRatingHistory(history);
      } catch (error) {
        console.error('Error fetching rating history:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHistory();
  }, [userName, selectedName]);
  
  // Process data based on time range
  const filteredHistory = useMemo(() => {
    if (!ratingHistory.length) {
      return [];
    }
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (timeRange) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        // 'all' - no filtering
        return ratingHistory;
    }
    
    return ratingHistory.filter(item => 
      new Date(item.timestamp) >= filterDate
    );
  }, [ratingHistory, timeRange]);
  
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!filteredHistory.length) {
      return { labels: [], datasets: [] };
    }
    
    // For a specific name
    if (selectedName) {
      return {
        labels: filteredHistory.map(item => 
          new Date(item.timestamp).toLocaleDateString()
        ),
        datasets: [
          {
            label: 'Rating',
            data: filteredHistory.map(item => item.new_rating),
            borderColor: 'rgba(75, 192, 192, 1)',
            tension: 0.1,
            fill: false
          }
        ]
      };
    }
    
    // Group by name for overall rating trends
    const nameGroups = filteredHistory.reduce((acc, item) => {
      if (!acc[item.name]) {
        acc[item.name] = [];
      }
      acc[item.name].push(item);
      return acc;
    }, {});
    
    // Get top 5 most active names
    const topNames = Object.entries(nameGroups)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([name]) => name);
      
    // Generate colors for each name
    const colors = [
      'rgba(75, 192, 192, 1)',
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(153, 102, 255, 1)'
    ];
    
    // Create a dataset for each name
    const datasets = topNames.map((name, index) => ({
      label: name,
      data: nameGroups[name].map(item => ({
        x: new Date(item.timestamp).toLocaleDateString(),
        y: item.new_rating
      })),
      borderColor: colors[index % colors.length],
      tension: 0.1,
      fill: false
    }));
    
    return {
      datasets
    };
  }, [filteredHistory, selectedName]);
  
  if (isLoading) {
    return <div className={styles.loadingSection}>Loading rating history...</div>;
  }
  
  if (!filteredHistory.length) {
    return (
      <div className={styles.emptyState}>
        <p>No rating history available for this time period.</p>
      </div>
    );
  }
  
  return (
    <div className={styles.ratingTrends}>
      <div className={styles.trendControls}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📈</span>
          Rating Trends
        </h3>
        <div className={styles.timeFilters}>
          <button 
            className={`${styles.button} ${timeRange === 'week' ? styles.primary : ''}`}
            onClick={() => setTimeRange('week')}
          >
            Week
          </button>
          <button 
            className={`${styles.button} ${timeRange === 'month' ? styles.primary : ''}`}
            onClick={() => setTimeRange('month')}
          >
            Month
          </button>
          <button 
            className={`${styles.button} ${timeRange === 'year' ? styles.primary : ''}`}
            onClick={() => setTimeRange('year')}
          >
            Year
          </button>
          <button 
            className={`${styles.button} ${timeRange === 'all' ? styles.primary : ''}`}
            onClick={() => setTimeRange('all')}
          >
            All Time
          </button>
        </div>
      </div>
      
      <div className={styles.chartWrapper}>
        <Line 
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: selectedName 
                  ? `Rating History for ${selectedName.name}`
                  : 'Rating Trends for Top Names'
              },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.dataset.label || '';
                    const value = context.parsed.y;
                    return `${label}: ${value}`;
                  }
                }
              }
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: timeRange === 'week' ? 'day' : 
                         timeRange === 'month' ? 'week' : 'month'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Rating'
                }
              }
            }
          }}
        />
      </div>
      
      {/* Recent changes summary */}
      <div className={styles.recentChanges}>
        <h4>Recent Rating Changes</h4>
        <div className={styles.changesList}>
          {filteredHistory.slice(0, 5).map((item, index) => (
            <div 
              key={index} 
              className={`${styles.changeItem} ${
                item.change > 0 ? styles.positive : 
                item.change < 0 ? styles.negative : ''
              }`}
            >
              <span className={styles.changeName}>{item.name}</span>
              <span className={styles.changeValue}>
                {item.change > 0 ? '+' : ''}{item.change}
              </span>
              <span className={styles.changeDate}>
                {new Date(item.timestamp).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// Add a Performance Insights component
const PerformanceInsights = memo(({ ratings }) => {
  // Calculate meaningful insights
  const insights = useMemo(() => {
    if (!ratings.length) {
      return [];
    }
    
    const totalMatches = ratings.reduce((sum, r) => sum + (r.wins || 0) + (r.losses || 0), 0);
    const avgRating = Math.round(
      ratings.reduce((sum, r) => sum + (r.rating || 1500), 0) / ratings.length
    );
    
    // Best performing names (highest win rate with min 5 matches)
    const bestPerformers = [...ratings]
      .filter(r => (r.wins || 0) + (r.losses || 0) >= 5)
      .sort((a, b) => {
        const aRate = a.wins / (a.wins + a.losses);
        const bRate = b.wins / (b.wins + b.losses);
        return bRate - aRate;
      })
      .slice(0, 3);
      
    // Trending names (recent rating increases)
    const trending = [...ratings]
      .filter(r => r.updated_at && new Date(r.updated_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
      
    // Names that need attention (low win rates)
    const needsAttention = [...ratings]
      .filter(r => (r.wins || 0) + (r.losses || 0) >= 5 && r.wins / (r.wins + r.losses) < 0.4)
      .sort((a, b) => {
        const aRate = a.wins / (a.wins + a.losses);
        const bRate = b.wins / (b.wins + b.losses);
        return aRate - bRate;
      })
      .slice(0, 3);
      
    return {
      totalMatches,
      avgRating,
      bestPerformers,
      trending,
      needsAttention
    };
  }, [ratings]);
  
  if (!ratings.length) {
    return null;
  }
  
  return (
    <div className={styles.insightsContainer}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>💡</span>
        Performance Insights
      </h3>
      
      <div className={styles.insightCards}>
        {insights.bestPerformers?.length > 0 && (
          <div className={styles.insightCard}>
            <h4 className={styles.insightTitle}>Best Performers</h4>
            <div className={styles.insightContent}>
              {insights.bestPerformers.map((name, i) => (
                <div key={i} className={styles.insightItem}>
                  <span className={styles.insightRank}>{i+1}</span>
                  <span className={styles.insightName}>{name.name}</span>
                  <span className={styles.insightValue}>
                    {Math.round((name.wins / (name.wins + name.losses)) * 100)}% win rate
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {insights.trending?.length > 0 && (
          <div className={styles.insightCard}>
            <h4 className={styles.insightTitle}>Trending Names</h4>
            <div className={styles.insightContent}>
              {insights.trending.map((name, i) => (
                <div key={i} className={styles.insightItem}>
                  <span className={styles.insightRank}>{i+1}</span>
                  <span className={styles.insightName}>{name.name}</span>
                  <span className={styles.insightValue}>
                    {name.rating} rating
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {insights.needsAttention?.length > 0 && (
          <div className={styles.insightCard}>
            <h4 className={styles.insightTitle}>Needs Attention</h4>
            <div className={styles.insightContent}>
              {insights.needsAttention.map((name, i) => (
                <div key={i} className={styles.insightItem}>
                  <span className={styles.insightRank}>{i+1}</span>
                  <span className={styles.insightName}>{name.name}</span>
                  <span className={styles.insightValue}>
                    {Math.round((name.wins / (name.wins + name.losses)) * 100)}% win rate
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Main Component
const Profile = ({ userName, onStartNewTournament }) => {
  // State
  const [isAdmin] = useState(userName.toLowerCase() === 'aaron');
  const [viewMode, setViewMode] = useState('individual');
  const [hiddenNames, setHiddenNames] = useState(new Set());
  const [showDeleteNameConfirm, setShowDeleteNameConfirm] = useState(false);
  const [nameToDelete, setNameToDelete] = useState(null);
  const [deleteNameStatus, setDeleteNameStatus] = useState({ loading: false, error: null });
  const [allUsersRatings, setAllUsersRatings] = useState({});
  const [userLastActivity, setUserLastActivity] = useState({});
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [currentUserRatings, setCurrentUserRatings] = useState([]);
  const [currentlyViewedUser, setCurrentlyViewedUser] = useState(userName);
  const [showAggregated, setShowAggregated] = useState(false);
  const [filterStatus, setFilterStatus] = useState(FILTER_OPTIONS.STATUS.ACTIVE);
  const [sortBy, setSortBy] = useState(FILTER_OPTIONS.SORT.RATING);

  // Data fetching
  const [ratingsData, setRatingsData, { loading: ratingsLoading, error: ratingsError }] = useSupabaseStorage('cat_name_ratings', [], userName);

  const fetchHiddenNames = useCallback(async () => {
    try {
      const { data: hiddenData, error: hiddenError } = await supabase
        .from('hidden_names')
        .select('name_id');

      if (hiddenError) {
        throw hiddenError;
      }

      const newHiddenNames = new Set(hiddenData?.map(item => item.name_id) || []);
      setHiddenNames(newHiddenNames);
    } catch (err) {
      console.error('Error fetching hidden names:', err);
    }
  }, []);

  const fetchUserRatings = useCallback(async (targetUserName) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('cat_name_ratings')
        .select(`
          rating,
          wins,
          losses,
          updated_at,
          name_options (
            id,
            name,
            description
          )
        `)
        .eq('user_name', targetUserName);

      if (fetchError) {
        throw fetchError;
      }

      const processedRatings = data
        ?.filter(item => item.name_options)
        .map(item => ({
          id: item.name_options.id,
          name: item.name_options.name,
          description: item.name_options.description,
          rating: parseInt(item.rating || DEFAULT_RATING, 10),
          wins: parseInt(item.wins || 0, 10),
          losses: parseInt(item.losses || 0, 10),
          updated_at: item.updated_at || new Date().toISOString()
        })) || [];

      setCurrentUserRatings(processedRatings);
    } catch (err) {
      console.error('Error fetching user ratings:', err);
    }
  }, []);

  const fetchAllUsersRatings = useCallback(async () => {
    try {
      setLoadingAllUsers(true);
      
      const { data, error: fetchError } = await supabase
        .from('cat_name_ratings')
        .select(`
          rating,
          wins,
          losses,
          user_name,
          updated_at,
          name_options (
            id,
            name,
            description
          )
        `);

      if (fetchError) {
        throw fetchError;
      }

      const { lastActivity, ratingsByUser } = processUserRatings(data);
      setUserLastActivity(lastActivity);
      setAllUsersRatings(ratingsByUser);
    } catch (err) {
      console.error('Error fetching all users ratings:', err);
    } finally {
      setLoadingAllUsers(false);
    }
  }, []);

  // Effects
  useEffect(() => {
    if (ratingsData?.length > 0) {
      setCurrentUserRatings(ratingsData);
    }
  }, [ratingsData]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllUsersRatings();
      fetchHiddenNames();
    }
  }, [isAdmin, fetchAllUsersRatings, fetchHiddenNames]);

  useEffect(() => {
    fetchHiddenNames();
    if (currentlyViewedUser) {
      fetchUserRatings(currentlyViewedUser);
    }
  }, [currentlyViewedUser, fetchHiddenNames, fetchUserRatings]);

  const handleUserAction = useCallback(async (action, user) => {
    if (action === 'view') {
      setCurrentlyViewedUser(user.name);
      await fetchUserRatings(user.name);
    } else if (action === 'delete') {
      try {
        await Promise.all([
          supabase.from('cat_name_ratings').delete().eq('user_name', user.name),
          supabase.from('tournament_progress').delete().eq('user_name', user.name)
        ]);
        await fetchAllUsersRatings();
      } catch (err) {
        console.error('Error deleting user:', err);
      }
    }
  }, [fetchAllUsersRatings, fetchUserRatings]);

  const handleToggleNameVisibility = useCallback(async (nameId, nameText) => {
    const isHidden = hiddenNames.has(nameId);
    if (!window.confirm(`Are you sure you want to ${isHidden ? 'show' : 'hide'} this name?`)) {
      return;
    }

    try {
      const { error } = isHidden 
        ? await supabase.from('hidden_names').delete().eq('name_id', nameId)
        : await supabase.from('hidden_names').insert([{ name_id: nameId }]);

      if (error) {
        throw error;
      }

      // Refresh hidden names after toggling
      await fetchHiddenNames();
    } catch (error) {
      console.error('Error toggling name visibility:', error);
    }
  }, [hiddenNames, fetchHiddenNames]);

  const handleDeleteName = useCallback(async (nameId) => {
    try {
      setDeleteNameStatus({ loading: true, error: null });
      const { error } = await deleteName(nameId);
      if (error) {
        throw error;
      }

      setRatingsData(prev => prev.filter(r => r.id !== nameId));
      setShowDeleteNameConfirm(false);
    } catch (err) {
      setDeleteNameStatus({ loading: false, error: err.message });
    }
  }, [setRatingsData]);

  const sortedRatings = useMemo(() => {
    const dataToUse = currentlyViewedUser !== userName ? currentUserRatings : ratingsData;
    return [...dataToUse].sort((a, b) => {
      switch (sortBy) {
        case FILTER_OPTIONS.SORT.RATING:
          return b.rating - a.rating;
        case FILTER_OPTIONS.SORT.WORST_RATING:
          return a.rating - b.rating;
        case FILTER_OPTIONS.SORT.NAME:
          return a.name.localeCompare(b.name);
        case FILTER_OPTIONS.SORT.LAST_UPDATED:
          return new Date(b.updated_at) - new Date(a.updated_at);
        case FILTER_OPTIONS.SORT.MATCHES:
          return (b.wins + b.losses) - (a.wins + a.losses);
        default:
          return 0;
      }
    });
  }, [ratingsData, sortBy, currentUserRatings, currentlyViewedUser, userName]);

  const filteredRatings = useMemo(() => {
    const dataToUse = currentlyViewedUser !== userName ? currentUserRatings : ratingsData;
    if (filterStatus === FILTER_OPTIONS.STATUS.ALL) {
      return dataToUse
        .filter(r => r && r.name) // Add null check
        .map(r => ({
          ...r,
          wins: parseInt(r.wins || 0, 10),
          losses: parseInt(r.losses || 0, 10),
          rating: parseInt(r.rating || DEFAULT_RATING, 10),
          updated_at: r.updated_at || new Date().toISOString()
        }));
    }
    
    return dataToUse
      .filter(r => {
        if (!r || !r.name) {
          return false;
        }
        const isHidden = hiddenNames.has(r.id);
        return filterStatus === FILTER_OPTIONS.STATUS.ACTIVE ? !isHidden : isHidden;
      })
      .map(r => ({
        ...r,
        wins: parseInt(r.wins || 0, 10),
        losses: parseInt(r.losses || 0, 10),
        rating: parseInt(r.rating || DEFAULT_RATING, 10),
        updated_at: r.updated_at || new Date().toISOString()
      }));
  }, [ratingsData, filterStatus, hiddenNames, currentlyViewedUser, userName, currentUserRatings]);

  const chartData = useMemo(() => 
    prepareChartData(
      currentlyViewedUser !== userName ? currentUserRatings : ratingsData, 
      filterStatus, 
      hiddenNames
    ), 
    [ratingsData, filterStatus, hiddenNames, currentUserRatings, currentlyViewedUser, userName]
  );

  if (ratingsLoading) {
    return <LoadingSpinner />;
  }
  if (ratingsError) {
    return <div>Error: {ratingsError.message}</div>;
  }

  const users = Object.entries(allUsersRatings).map(([name, ratings]) => ({
    id: name,
    name,
    ratingsCount: ratings.length,
    averageRating: ratings.reduce((sum, r) => sum + (r.rating || DEFAULT_RATING), 0) / ratings.length,
    lastActive: userLastActivity[name],
    isActive: Date.now() - new Date(userLastActivity[name]).getTime() < ACTIVE_THRESHOLD
  }));

  return (
    <div className={styles.profileContainer}>
      <header className={styles.profileHeader}>
        <h1>{currentlyViewedUser}'s Cat Name Rankings</h1>
        <div className={styles.headerActions}>
          {isAdmin && (
            <Button 
              onClick={() => setShowAggregated(!showAggregated)}
              variant="default"
            >
              {showAggregated ? 'Show Individual View' : 'Show Overall Rankings'}
            </Button>
          )}
          {userName.toLowerCase() === 'aaron' && (
            <Button onClick={onStartNewTournament}>Start Tournament</Button>
          )}
        </div>
      </header>

      {isAdmin && !showAggregated && (
        <AdminPanel
          users={users}
          onRefresh={handleUserAction}
        />
      )}

      <div className={styles.mainContent}>
        {showAggregated ? (
          <AggregatedStats 
            allUsersRatings={allUsersRatings}
            onToggleVisibility={handleToggleNameVisibility}
            onDelete={handleDeleteName}
            isAdmin={isAdmin}
          />
        ) : (
          <>
            <div className={styles.profileOverview}>
              <ProfileStats 
                ratings={currentlyViewedUser !== userName ? currentUserRatings : ratingsData} 
                filterStatus={filterStatus} 
              />
              
              {/* Add the new Performance Insights component */}
              <PerformanceInsights 
                ratings={currentlyViewedUser !== userName ? currentUserRatings : ratingsData}
              />
            </div>
            
            {/* Add the new Rating Trends component */}
            <RatingTrends 
              userName={currentlyViewedUser} 
              selectedName={null}
            />

            <FilterControls 
              onFilterChange={setFilterStatus}
              onSortChange={setSortBy}
              currentFilter={filterStatus}
              currentSort={sortBy}
            />

            <div className={styles.chartContainer}>
              <Bar 
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const rating = context.raw;
                          const name = context.label;
                          const isHidden = ratingsData.find(r => r.name === name)?.isHidden;
                          return `${name}: ${rating} ${isHidden ? '(Hidden)' : ''}`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: false,
                      min: Math.min(...ratingsData.map(r => r.rating)) - 100,
                      title: {
                        display: true,
                        text: 'Rating'
                      }
                    }
                  }
                }}
              />
            </div>

            <div className={styles.namesGrid}>
              {filteredRatings.map(name => (
                <NameCard
                  key={name.id}
                  name={{
                    ...name,
                    name: name.name,
                    averageRating: name.rating,
                    totalVotes: 1,
                    userCount: 1
                  }}
                  isHidden={hiddenNames.has(name.id)}
                  onToggleVisibility={handleToggleNameVisibility}
                  onDelete={handleDeleteName}
                  isAdmin={isAdmin}
                  isAggregated={false}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Modal
        title="Delete Name"
        isOpen={showDeleteNameConfirm}
        onClose={() => setShowDeleteNameConfirm(false)}
      >
        <p>Are you sure you want to permanently delete <strong>{nameToDelete?.name}</strong>?</p>
        <p className={styles.warningText}>This action cannot be undone!</p>
        
        <div className={styles.modalButtons}>
          <Button 
            onClick={() => handleDeleteName(nameToDelete.id)}
            variant="delete"
            disabled={deleteNameStatus.loading}
          >
            {deleteNameStatus.loading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
          <Button 
            onClick={() => setShowDeleteNameConfirm(false)}
            disabled={deleteNameStatus.loading}
          >
            Cancel
          </Button>
        </div>
        {deleteNameStatus.error && (
          <p className={styles.errorMessage}>
            Error: {deleteNameStatus.error}
          </p>
        )}
      </Modal>
    </div>
  );
};

export default Profile;